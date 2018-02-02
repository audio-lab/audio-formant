'use strict'
const regl =  require('regl')({
	extensions: ['OES_texture_float'],
	optionalExtensions: ['oes_texture_float_linear'],
	// attributes: {preserveDrawingBuffer: true}
})
const createSettings = require('settings-panel')
const ctx = require('audio-context')()
const write = require('web-audio-write')(ctx.destination, {channels: 1})
const spectrum = require('../../gl-spectrum')({ weighting: 'm'})
const fft = require('fourier-transform')
const db = require('decibels')
const blackman = require('scijs-window-functions/blackman-harris');

let Q = .5, frequency = 440, amplitude = 1

//settings
let settings = createSettings([
	{id: 'frequency', type: 'range', value: frequency, step: 1, min: 0, max: 20000, change: v => {
		frequency = v
	}},
	{id: 'quality', type: 'range', value: Q, step: 0.001, min: 0, max: 1, change: v => {
		Q = v
	}},
	{id: 'amplitude', type: 'range', value: 1, min: 0, max: 1, change: amp => {

	}}
])


const BLOCK_SIZE = 1024
const CHANNELS = 2
const FORMANT_COUNT = 1

let currentPhase = 0


//texture with noise sample
//FIXME: think on possible speeding up this
let noiseTexture = regl.texture({
	width: 1024,
	height: 1024,
	format: 'rgba',
	type: 'float',
	data: Array(1024*1024*4).fill(0).map(Math.random)
})

//phase texture keeps sine phase picked
let phaseTexture = [
	regl.texture({
		width: BLOCK_SIZE/4,
		height: 1,
		format: 'rgba',
		type: 'float'
	}),
	regl.texture({
		width: BLOCK_SIZE/4,
		height: 1,
		format: 'rgba',
		type: 'float'
	})
]


//framebuffer
let phaseFBO = [
	regl.framebuffer({
		width: BLOCK_SIZE/4,
		height: 1,
		depthStencil: false,
		color: phaseTexture[0]
	}),
	regl.framebuffer({
		width: BLOCK_SIZE/4,
		height: 1,
		depthStencil: false,
		color: phaseTexture[1]
	})
]

let outputFBO = regl.framebuffer({
	width: BLOCK_SIZE/4,
	height: 1,
	depthStencil: false,
	colorType: 'float',
	colorFormat: 'rgba'
})


//programs
let samplePhase = regl({
	vert: `
	attribute vec2 position;
	void main () {
		gl_Position = vec4(position, 0, 1);
	}
	`,

	frag: `
	precision highp float;

	uniform sampler2D noise;
	uniform sampler2D phase;

	uniform float period, quality;

	const float BLOCK_SIZE = ${BLOCK_SIZE/4}.;
	const float FORMANT_COUNT = ${FORMANT_COUNT}.;
	const float SAMPLE_RATE = ${ctx.sampleRate}.;
	const float FS = ${ctx.sampleRate/2}.;
	const float TAU = ${Math.PI * 2};

	void main (void) {
		float left = floor(gl_FragCoord.x);
		vec2 xy = vec2(gl_FragCoord.x / BLOCK_SIZE, gl_FragCoord.y / FORMANT_COUNT);

		float lastSample = texture2D(phase, vec2( (BLOCK_SIZE - 0.5) / BLOCK_SIZE, xy.y)).w;
		float phaseStep;

		vec4 sample, formant;
		vec2 coord = xy;

		float frequency = clamp(1. / period, 0., FS);
		float range = clamp(frequency / tan(TAU * quality), 0., FS);

		sample = vec4(lastSample, 0, 0, 0);

		for (float i = 0.; i < BLOCK_SIZE; i++) {
			coord.x = i / BLOCK_SIZE;

			vec2 noiseCoord = coord + texture2D(phase, vec2(cos(coord.y*13. + coord.x), sin(coord.x*17.))).yx;

			sample = texture2D(noise, noiseCoord);

			phaseStep = (frequency + sample.x*range - range*0.5) / SAMPLE_RATE;
			sample.x = fract( phaseStep + lastSample);

			phaseStep = (frequency + sample.y*range - range*0.5) / SAMPLE_RATE;
			sample.y = fract( phaseStep + sample.x);

			phaseStep = (frequency + sample.z*range - range*0.5) / SAMPLE_RATE;
			sample.z = fract( phaseStep + sample.y);

			phaseStep = (frequency + sample.w*range - range*0.5) / SAMPLE_RATE;
			sample.w = fract( phaseStep + sample.z);

			lastSample = sample.w;

			if (left == i) {
				gl_FragColor = sample;
				break;
			}
		}
	}
	`,

	uniforms: {
		period: (ctx, props) => 1 / props.frequency,
		quality: regl.prop('Q'),
		noise: noiseTexture,
		phase: () => {
			return currentPhase ? phaseTexture[0] : phaseTexture[1]
		}

	},
	attributes: {
		position: [-1,-1,-1,3,3,-1]
	},
	count: 3,
	primitive: 'triangles'
})


let merge = regl({
	vert: `
	attribute vec2 position;
	void main () {
		gl_Position = vec4(position, 0, 1);
	}
	`,
	frag: `
	precision highp float;

	uniform sampler2D phases;

	const float BLOCK_SIZE = ${BLOCK_SIZE/4}.;
	const float FORMANT_COUNT = ${FORMANT_COUNT}.;
	const float TAU = ${Math.PI * 2};

	void main () {
		vec4 formant, phase;
		vec4 sum = vec4(0);
		vec2 xy;
		float channel = floor(gl_FragCoord.y);

		float amplitude = 1., maxAmplitude = 1., pan = .5;

		//find max amplitude first to redistribute amplitudes
		//float maxAmplitude = 0.;
		//for (float i = 0.; i < FORMANT_COUNT; i++) {
		//	xy = vec2(gl_FragCoord.x / BLOCK_SIZE, i / FORMANT_COUNT);
		//	formant = texture2D(formants, xy);
		//	float amplitude = formant[1];

		//	maxAmplitude = maxAmplitude + amplitude;
		//}

		//maxAmplitude = max(maxAmplitude, 1.);

		//sum all formant sampled phases regarding current channel and max amplitude

		for (float i = 0.; i < FORMANT_COUNT; i++) {
			xy = vec2(gl_FragCoord.x / BLOCK_SIZE, i / FORMANT_COUNT);

			phase = texture2D(phases, xy);

			//formant = texture2D(formants, xy);
			//float amplitude = formant[1] / maxAmplitude;
			//float pan = formant[3];
			float mix = 1. - min( abs(channel - pan), 1.);

			sum += vec4(
				cos(TAU * phase.x) * amplitude * mix,
				cos(TAU * phase.y) * amplitude * mix,
				cos(TAU * phase.z) * amplitude * mix,
				cos(TAU * phase.w) * amplitude * mix
			);
		}

		gl_FragColor = sum;
	}
	`,
	attributes: {
		position: [-1,-1,-1,3,3,-1]
	},
	uniforms: {
		phases: () => {
			return phaseTexture[currentPhase]
		}
	},
	count: 3,
	primitive: 'triangles'
})



let arr = new Float32Array(BLOCK_SIZE)


let count = 0;
function output () {
	// if (count > 200) {
	// 	write(null);
	// 	return;
	// }

	phaseFBO[currentPhase].use(() => {
		samplePhase({Q: Q, frequency: frequency})
	})

	outputFBO.use(() => {
		merge()
		regl.read({data: arr})
	})
	currentPhase = (currentPhase + 1) % 2
	write(arr, output)

	let dbMagnitudes = fft(arr.map((v, i) => v*blackman(i, arr.length)));
	dbMagnitudes = dbMagnitudes.map((f, i) => db.fromGain(f));

	spectrum.set(dbMagnitudes)

	count++
}
output()


//show array
function draw(arr) {
	let canvas = document.body.appendChild(document.createElement('canvas'))
	let ctx = canvas.getContext('2d')
	let w = canvas.width, h = canvas.height

	for (let i = 0, l = arr.length; i < l; i++) {
		ctx.fillRect(w * i/l, h*.5, 1, h*.5*arr[i])
	}
}
