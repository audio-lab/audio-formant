/**
 * Pipe in formants, pipe out sound duplex stream.
 * Control the pressure of input formants based on the realtime/offline output stream.
 * They probably do calculation to current tempo based on number of samples passed.
 *
 * @module  formant-stream
 */

var createContext = require('webgl-context');
var extend = require('xtend/mutable');


module.exports = Formant;


//TODO: pack varyings noise uncertainty denser - probably we can pack up to 32 steps into single float of varying, if it is enough 0/1 for our noise. That would be more than enough even for firefox (580 items).
//TODO: get rid of if's


/**
 * @constructor
 */
function Formant (options) {
	if (!(this instanceof Formant)) return new Formant(options);

	extend(this, options);

	var formantsData;
	if (Array.isArray(this.formants) || ArrayBuffer.isView(this.formants)) {
		formantsData = this.formants;
		this.formants = formantsData.length / 4;
	}

	//init context
	if (!this.gl) {
		this.gl = createContext({
			width: this.width,
			height: this.height
		});
	}

	var gl = this.gl;

	// micro optimizations
	gl.disable(gl.DEPTH_TEST);
	gl.disable(gl.BLEND);
	gl.disable(gl.CULL_FACE);
	gl.disable(gl.DITHER);
	gl.disable(gl.POLYGON_OFFSET_FILL);
	gl.disable(gl.SAMPLE_COVERAGE);
	gl.disable(gl.SCISSOR_TEST);
	gl.disable(gl.STENCIL_TEST);


	//enable requried extensions
	var float = gl.getExtension('OES_texture_float');
	if (!float) throw Error('WebGL does not support floats.');
	var floatLinear = gl.getExtension('OES_texture_float_linear');
	if (!floatLinear) throw Error('WebGL does not support floats.');


	//init textures
	this.textures = {
		formants: createTexture(gl),
		noise: createTexture(gl),
		source: createTexture(gl),
		phases: [createTexture(gl), createTexture(gl)],
		output: createTexture(gl)
	};

	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, this.textures.phases[0]);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.blockSize/4, this.formants, 0, gl.RGBA, gl.FLOAT, null);

	gl.activeTexture(gl.TEXTURE1);
	gl.bindTexture(gl.TEXTURE_2D, this.textures.phases[1]);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.blockSize/4, this.formants, 0, gl.RGBA, gl.FLOAT, null);

	gl.activeTexture(gl.TEXTURE2);
	gl.bindTexture(gl.TEXTURE_2D, this.textures.formants);
	this.setFormants(formantsData);

	gl.activeTexture(gl.TEXTURE3);
	gl.bindTexture(gl.TEXTURE_2D, this.textures.noise);
	this.setNoise();

	gl.activeTexture(gl.TEXTURE4);
	gl.bindTexture(gl.TEXTURE_2D, this.textures.source);
	this.setSource();

	gl.activeTexture(gl.TEXTURE5);
	gl.bindTexture(gl.TEXTURE_2D, this.textures.output);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.blockSize/4, this.channels, 0, gl.RGBA, gl.FLOAT, null);


	//init framebuffers
	this.framebuffers = {
		//phases are rendered in turn to keep previous state
		phases: [
			gl.createFramebuffer(),
			gl.createFramebuffer()
		],
		merge: gl.createFramebuffer()
	};

	gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers.phases[0]);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.textures.phases[0], 0);

	gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers.phases[1]);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.textures.phases[1], 0);

	gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers.merge);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.textures.output, 0);

	//setup shader sources
	var rectSrc = `
	attribute vec2 position;
	void main () {
		gl_Position = vec4(position, 0, 1);
	}`;


	//generating phase texture of formants data
	var phaseSrc = `
	precision ${this.precision} float;

	uniform sampler2D formants;
	uniform sampler2D noise;
	uniform sampler2D phases;

	const float width = ${this.blockSize/4}.;
	const float height = ${this.formants}.;
	const float sampleRate = ${this.sampleRate}.;
	const float fs = ${this.sampleRate/2}.;
	const float pi2 = ${Math.PI / 2};

	float getStep (float f) {
		return f / sampleRate;
	}

	void main (void) {
		float left = floor(gl_FragCoord.x);
		vec2 xy = vec2(gl_FragCoord.x / width, gl_FragCoord.y / height);

		float lastSample = texture2D(phases, vec2( (width - 0.5) / width, xy.y)).w;
		float step, overstep = 0.;

		vec4 sample, formant;
		vec2 coord = xy;

		for (float i = 0.; i < width; i++) {
			coord.x = i / width;

			vec2 noiseCoord = coord + texture2D(phases, vec2(cos(coord.y + coord.x), sin(coord.x))).yx;

			sample = texture2D(noise, noiseCoord);

			formant = texture2D(formants, coord);
			float period = formant[0];
			float quality = formant[2];

			float frequency = clamp(1. / period, 0., fs);
			float range = clamp(frequency / tan(pi2 * quality), 0., fs);

			//walk 4 steps
			step = getStep(frequency + sample.x*range - range*0.5);// + overstep;
			overstep = min(0., step);
			step = max(0., step) + overstep;
			sample.x = fract( step + lastSample);

			step = getStep(frequency + sample.y*range - range*0.5);// + overstep;
			overstep = min(0., step);
			step = max(0., step) + overstep;
			sample.y = fract( step + sample.x);

			step = getStep(frequency + sample.z*range - range*0.5);// + overstep;
			overstep = min(0., step);
			step = max(0., step) + overstep;
			sample.z = fract( step + sample.y);

			step = getStep(frequency + sample.w*range - range*0.5);// + overstep;
			overstep = min(0., step);
			step = max(0., step) + overstep;
			sample.w = fract( step + sample.z);

			lastSample = sample.w;

			if (left == i) {
				gl_FragColor = sample;
				break;
			}
		}
	}`;

	//sample input phases and merge waveforms, distributing by channels
	var mergeSrc = `
	precision ${this.precision} float;

	uniform sampler2D source;
	uniform sampler2D formants;
	uniform sampler2D phases;

	const float width = ${this.blockSize/4}.;
	const float height = ${this.formants}.;
	const float sampleRate = ${this.sampleRate}.;
	const int waveform = ${this.waveform};

	void main () {
		vec4 formant, phase;
		vec4 sum = vec4(0);
		vec2 xy;
		float channel = floor(gl_FragCoord.y);

		//find max amplitude first to redistribute amplitudes
		float maxAmplitude = 0.;
		for (float i = 0.; i < height; i++) {
			xy = vec2(gl_FragCoord.x / width, i / height);
			formant = texture2D(formants, xy);
			float amplitude = formant[1];

			maxAmplitude = maxAmplitude + amplitude;
		}

		maxAmplitude = max(maxAmplitude, 1.);

		//sum all formant sampled phases regarding current channel and max amplitude
		for (float i = 0.; i < height; i++) {
			xy = vec2(gl_FragCoord.x / width, i / height);

			phase = texture2D(phases, xy);
			formant = texture2D(formants, xy);
			float amplitude = formant[1] / maxAmplitude;
			float pan = formant[3];
			float mix = 1. - min( abs(channel - pan), 1.);

			sum += vec4(
				texture2D(source, vec2(phase.x, 0))[waveform] * amplitude * mix,
				texture2D(source, vec2(phase.y, 0))[waveform] * amplitude * mix,
				texture2D(source, vec2(phase.z, 0))[waveform] * amplitude * mix,
				texture2D(source, vec2(phase.w, 0))[waveform] * amplitude * mix
			);
		}

		gl_FragColor = sum;
	}`;


	//init programs
	this.programs = {
		phases: createProgram(gl, rectSrc, phaseSrc),
		merge: createProgram(gl, rectSrc, mergeSrc)
	};

	var buffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,-1,3,3,-1]), gl.STATIC_DRAW);
	gl.enableVertexAttribArray(0);
	gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
	gl.bindAttribLocation(this.programs.phases, 0, 'position');
	gl.bindAttribLocation(this.programs.merge, 0, 'position');

	gl.linkProgram(this.programs.phases);
	gl.linkProgram(this.programs.merge);

	//save locations
	this.locations = {
		phases: {},
		merge: {}
	};

	this.locations.phases.formants = gl.getUniformLocation(this.programs.phases, 'formants');
	this.locations.phases.noise = gl.getUniformLocation(this.programs.phases, 'noise');
	this.locations.phases.phases = gl.getUniformLocation(this.programs.phases, 'phases');

	this.locations.merge.phases = gl.getUniformLocation(this.programs.merge, 'phases');
	this.locations.merge.source = gl.getUniformLocation(this.programs.merge, 'source');
	this.locations.merge.formants = gl.getUniformLocation(this.programs.merge, 'formants');

	//bind uniforms
	gl.useProgram(this.programs.phases);
	gl.uniform1i(this.locations.phases.formants, 2);
	gl.uniform1i(this.locations.phases.noise, 3);

	gl.useProgram(this.programs.merge);
	gl.uniform1i(this.locations.merge.formants, 2);
	gl.uniform1i(this.locations.merge.source, 4);

	//current phase texture being used for rendering/stream
	this.activePhase = 0;
}



/**
 * Output sample rate
 */
Formant.prototype.sampleRate = 44100;


/**
 * Output number of channels
 */
Formant.prototype.channels = 2;


/**
 * Output block size
 */
Formant.prototype.blockSize = 512;


/**
 * Noise texture dimensions
 */
Formant.prototype.noiseWidht = 256;
Formant.prototype.noiseHeight = 256;


/**
 * Source texture length
 */
Formant.prototype.sourceWidth = 256;


/**
 * Number of formants to process
 */
Formant.prototype.formants = 4;

/**
 * Precision declarator for formants code
 */
Formant.prototype.precision = 'lowp';


/**
 * 0 - sine
 * 1 - rectangle
 * 2 - triangle
 * 3 - saw
 */
Formant.prototype.waveform = 0;




/**
 * Set formants data.
 * Use mostly for demo/test purposes.
 * In production it is faster to render straight to `textures.formants`
 */
Formant.prototype.setFormants = function (formants) {
	var gl = this.gl;
	var data = null;
	var w = this.blockSize/4, h = this.formants;

	if (formants) {
		if (formants.length/4 !== h) throw Error('Formants data size should correspond to number of formants: ' + h);

		data = new Float32Array(w * this.formants * 4);

		//fill rows with formants values
		for (var j = 0; j < h; j++) {
			for (var i = 0; i < w; i++) {
				data[j*w*4 + i*4 + 0] = formants[j*4 + 0];
				data[j*w*4 + i*4 + 1] = formants[j*4 + 1];
				data[j*w*4 + i*4 + 2] = formants[j*4 + 2];
				data[j*w*4 + i*4 + 3] = formants[j*4 + 3];
			}
		}

	}

	gl.bindTexture(gl.TEXTURE_2D, this.textures.formants);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.FLOAT, data);
};


/**
 * Update noise texture.
 * Call if feel need to updating noise.
 */
Formant.prototype.setNoise = function (data) {
	var w = this.noiseWidht, h = this.noiseHeight;
	var gl = this.gl;

	if (!data) {
		data = generateNoise(w, h);
	}

	gl.bindTexture(gl.TEXTURE_2D, this.textures.noise);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.FLOAT, data);

	return this;
};


/**
 * Fill source texture with values of data,
 * or sine if data is omitted
 */
Formant.prototype.setSource = function (data) {
	var gl = this.gl;

	if (!data) {
		var sourceLen = this.sourceWidth*4;
		data = new Float32Array(sourceLen);
		var half = this.sourceWidth/2;

		for (var i = 0; i < this.sourceWidth; i++) {
			//sin
			data[i*4] = Math.sin( i * (Math.PI * 2) / this.sourceWidth);
			//rect
			data[i*4+1] = i < half ? 1 : -1;
			//triangle
			data[i*4+2] = i < half ? 1 - 2 * i / half : -1 + 2 * (i - half) / half;
			//saw
			data[i*4+3] = 1 - 2 * i / this.sourceWidth;
		}
	}
	else {
		sourceLen = data.length;
	}

	gl.bindTexture(gl.TEXTURE_2D, this.textures.source);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.sourceWidth, 1, 0, gl.RGBA, gl.FLOAT, data);

	return this;
};


/**
 * Populates passed buffer with audio data separated by channels.
 * If buffer is undefined - a new one will be created
 */
Formant.prototype.populate = function (buffer) {
	var gl = this.gl;

	if (!buffer) {
		buffer = new Float32Array(this.channels * this.blockSize);
	}

	var currentPhase = this.activePhase;
	this.activePhase = (this.activePhase + 1) % 2;

	//render phase texture
	gl.useProgram(this.programs.phases);
	gl.uniform1i(this.locations.phases.phases, this.activePhase);
	gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers.phases[currentPhase]);
	gl.drawArrays(gl.TRIANGLES, 0, 3);

	// buffer.phases = new Float32Array(this.formants * this.blockSize);
	// gl.readPixels(0, 0, this.blockSize/4, this.formants, gl.RGBA, gl.FLOAT, buffer.phases);

	//sample rendered phases and distribute to channels
	gl.useProgram(this.programs.merge);
	gl.uniform1i(this.locations.merge.phases, currentPhase);
	gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers.merge);
	gl.drawArrays(gl.TRIANGLES, 0, 3);

	gl.readPixels(0, 0, this.blockSize/4, this.channels, gl.RGBA, gl.FLOAT, buffer);

	return buffer;
};




//create program (2 shaders)
function createProgram (gl, vSrc, fSrc) {
	var fShader = gl.createShader(gl.FRAGMENT_SHADER);
	var vShader = gl.createShader(gl.VERTEX_SHADER);

	gl.shaderSource(fShader, fSrc);
	gl.shaderSource(vShader, vSrc);

	gl.compileShader(fShader);

	if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) {
		console.error(gl.getShaderInfoLog(fShader));
	}

	gl.compileShader(vShader);

	if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) {
		console.error(gl.getShaderInfoLog(vShader));
	}


	var program = gl.createProgram();
	gl.attachShader(program, vShader);
	gl.attachShader(program, fShader);
	gl.linkProgram(program);

	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		console.error(gl.getProgramInfoLog(program));
	}

	gl.useProgram(program);

	return program;
}

//create texture
function createTexture (gl) {
	var texture = gl.createTexture();

	gl.activeTexture(gl.TEXTURE2);

	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

	return texture;
}

/**
 * Initialize additive noise textures.
 */
//TODO: optimize this part, too many things can be done in parallel
function generateNoise (w, h) {
	var data = new Float32Array(w*h*4);

	for (var j = 0; j < h; j++) {
		var prev = 0;

		//fill rows with random sequence of phase
		for (var i = 0; i < w; i++) {
			prev = data[j*w*4 + i*4] = (prev + Math.random()) % 1;
			prev = data[j*w*4 + i*4+1] = (prev + Math.random()) % 1;
			prev = data[j*w*4 + i*4+2] = (prev + Math.random()) % 1;
			prev = data[j*w*4 + i*4+3] = (prev + Math.random()) % 1;
		}
	}

	return data;
};