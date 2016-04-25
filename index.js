/**
 * To render long buffers we should have:
 * - inner state with the last offset
 * - two shaders ping ponging textures to avoid readpixels
 */


var createContext = require('webgl-context');
var createShader = require('gl-shader-core');
var glslify = require('glslify');


//default buffer size to render (in pixels)
var width = 512/4;
var height = 1;

//number of varyings to use, max - 29
var VARYINGS = 29;

var blocksNumber = width / VARYINGS;

//default sample rate
var sampleRate = 44100;

var gl = createContext({
	width: width,
	height: height
});


// micro optimizations
gl.disable(gl.DEPTH_TEST);
gl.disable(gl.BLEND);
gl.disable(gl.CULL_FACE);
gl.disable(gl.DITHER);
gl.disable(gl.POLYGON_OFFSET_FILL);
gl.disable(gl.SAMPLE_COVERAGE);
gl.disable(gl.SCISSOR_TEST);
gl.disable(gl.STENCIL_TEST);

gl.lineWidth(1.0);


//enable requried extensions
var float = gl.getExtension('OES_texture_float');
if (!float) throw Error('WebGL does not support floats.');
var floatLinear = gl.getExtension('OES_texture_float_linear');
if (!floatLinear) throw Error('WebGL does not support floats.');
// var bufs = gl.getExtension('WEBGL_draw_buffers');
// if (!bufs) throw Error('WebGL does not support floats.');




var vSrc = function (isEven, VARYINGS) { return `
	precision lowp float;

	//coords of a vertex
	attribute vec2 position;

	//noise samples
	uniform sampler2D noise;

	//size of generated noise steps
	uniform float frequency;

	//variance of generated noise steps
	uniform float quality;

	//noise accumulator to pick values from the source texture
	varying vec4 samples[${VARYINGS}];

	//texture of last rendered frame
	uniform sampler2D lastOutput;

	//return step value for the frequency
	//step is how many samples we should skip in texture to obtain needed frequency
	//0 = 0hz, 0.5 = π
	float getStep (float f) {
		return f / ${ sampleRate }.;
	}

	//generate samples
	void main (void) {
		gl_Position = vec4(position, 0, 1);

		float range = 1000.;

		float lastSample = 0.0;
		vec4 sample;

		float someOutputSample = texture2D(lastOutput, vec2(${isEven ? .25 : .75}, 0)).y;

		//FIXME: extra 3 calculations here, for each vertex. Use it.
		for (int idx = 0; idx < ${VARYINGS}; idx++) {
			float i = float(idx);

			//pick new noise coord from the last output
			//hope it gets close to random noise coords
			vec2 coord = texture2D(lastOutput, vec2( someOutputSample + i * 0.571 / ${VARYINGS}., 0)).${isEven ? 'xz': 'wy'};

			//noise step from last sample
			sample = texture2D(noise, coord);

			sample.x = fract( getStep(frequency + sample.x*range - range*0.5) + lastSample);
			sample.y = fract( getStep(frequency + sample.y*range - range*0.5) + sample.x);
			sample.z = fract( getStep(frequency + sample.z*range - range*0.5) + sample.y);
			sample.w = fract( getStep(frequency + sample.w*range - range*0.5) + sample.z);

			//save last offset
			lastSample = sample.w;

			samples[idx] = sample;
		}
	}
`; }

var fSrc = function (isEven, VARYINGS) { return `
	precision lowp float;

	//noise samples
	uniform sampler2D noise;

	//FIXME: take texture output
	//previous values
	uniform sampler2D prev;

	//amplitude
	uniform float amplitude;

	//positions to pick from source
	varying vec4 samples[${VARYINGS}];

	//get generated sample
	vec4 getSample(int idx) {
		${Array(VARYINGS).fill(0).map(function (x, i) {
			return `if (idx == ${i}) return samples[${i}];`;
		}).join('\n')}
		return samples[${VARYINGS - 1}];
	}

	void main (void) {
		float x = floor(gl_FragCoord.x);

		//relative x coordinate, inner offset within the viewport
		//inner offset can be more than 29
		${
			isEven ?
			`float innerOffset = mod(x, ${VARYINGS*2}.);` :
			`float innerOffset = mod(x + ${VARYINGS}., ${VARYINGS*2}.);`
		}


		int idx = int(innerOffset);

		//start block coordinate - outer offset in pixels
		float start = x - innerOffset;

		//prev block contains offset at the position of current block
		vec2 offsetCoord = vec2( (start) / ${width}., 0);
		float offset = texture2D(prev, offsetCoord).w;

		//get sound source position
		vec4 pos = fract(getSample(idx) + offset);

		//render 4 waveform samples
		//FIXME: 3 channels of the source texture are empty
		//FIXME: y-position of the texture is unused

		//save collected offset
		gl_FragColor = pos;

	}
`;}

var vRectSrc = `
	attribute vec2 position;

	void main () {
		gl_Position = vec4(position, 0, 1);
	}
`;

//even step phase renderer
var evenProgram = createProgram(gl, vSrc(true, VARYINGS), fSrc(true, VARYINGS));

//odd step phase renderer
var oddProgram = createProgram(gl, vSrc(false, VARYINGS), fSrc(false, VARYINGS));

//merge phase textures into single texture
var mergeProgram = createProgram(gl, vRectSrc, `
	precision lowp float;

	//sampled phases
	uniform sampler2D even;
	uniform sampler2D odd;

	bool isEven(float x) {
		return mod(x, 2.0) == 0.0;
	}

	void main () {
		float w = ${width}.;
		float x = gl_FragCoord.x;
		float innerOffset = mod(floor(x), ${VARYINGS}.);
		float outerOffset = floor(floor(x) / ${VARYINGS}.);
		vec4 phase;

		if (isEven(outerOffset)) {
			phase = texture2D(even, vec2(x / w, 0));
		} else {
			phase = texture2D(odd, vec2(x / w, 0));
		}

		gl_FragColor = phase;
	}
`);

//convert phase texture into a source sound samples
var sampleProgram = createProgram(gl, vRectSrc, `
	precision lowp float;

	uniform sampler2D source;
	uniform sampler2D phase;

	void main () {
		vec4 phaseSamples = texture2D(phase, vec2(gl_FragCoord.x / ${width}., 0));

		gl_FragColor = vec4(
			texture2D(source, vec2(phaseSamples.x, 0)).x,
			texture2D(source, vec2(phaseSamples.y, 0)).x,
			texture2D(source, vec2(phaseSamples.z, 0)).x,
			texture2D(source, vec2(phaseSamples.w, 0)).x
		);
	}
`);

//copy the end of phase texture into the beginning of the right one
var copyProgram = createProgram(gl, vRectSrc, `
	precision lowp float;

	uniform sampler2D phase;

	void main () {
		gl_FragColor = texture2D(phase, vec2(${width-1}. / ${width}., 0));
	}
`);



//create input buffer with number of verteces === height
var buffer = gl.createBuffer();
var verteces = new Float32Array(createVerteces(blocksNumber, height));
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.bufferData(gl.ARRAY_BUFFER, verteces, gl.STATIC_DRAW);

gl.enableVertexAttribArray(1)
//index, size, type, normalized, stride, offset (pointer)
gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
gl.bindAttribLocation(evenProgram, 1, 'position');
gl.bindAttribLocation(oddProgram, 1, 'position');

function createVerteces (m, n) {
	var res = [];

	var lastX = -1;
	var stepX = 2 / m;

	for (var x = 0; x < Math.ceil(m); x++) {
		var lastY = 1;
		var stepY = 2 / n;
		for (var y = 0; y < n; y++) {
			res.push( lastX );
			res.push( lastY - stepY*.5 );
			//should overlap a tiny bit to save offset info
			res.push( lastX + stepX*1.05 );
			res.push( lastY - stepY*.5);
			lastY -= stepY;
		}
		lastX += stepX;
	}

	return res;
}

//create merging shader a-big-triangle output
var buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,-1,3,3,-1]), gl.STATIC_DRAW);
gl.enableVertexAttribArray(2)
gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);
gl.bindAttribLocation(sampleProgram, 2, 'position');
gl.bindAttribLocation(mergeProgram, 2, 'position');
gl.bindAttribLocation(copyProgram, 2, 'position');


//relink program after binding attribs
gl.linkProgram(evenProgram);
gl.linkProgram(oddProgram);
gl.linkProgram(mergeProgram);
gl.linkProgram(copyProgram);
gl.linkProgram(sampleProgram);



//create main framebuffers
var evenFramebuffer = gl.createFramebuffer();
var oddFramebuffer = gl.createFramebuffer();
var mergeFramebuffer = gl.createFramebuffer(); //phase merge
var sampleFramebuffer = gl.createFramebuffer(); //sample phase
var copyFramebuffer = gl.createFramebuffer(); //copy


//create main textures
var leftTexture = createTexture(gl);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.FLOAT, null);

var rightTexture = createTexture(gl);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.FLOAT, null);

var outputTexture = createTexture(gl);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.FLOAT, new Float32Array(generateNoise(width*height*4)));

var phaseTexture = createTexture(gl);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.FLOAT, null);



//bind output textures to framebuffers
gl.bindFramebuffer(gl.FRAMEBUFFER, evenFramebuffer);
gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, leftTexture, 0);
gl.bindFramebuffer(gl.FRAMEBUFFER, oddFramebuffer);
gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, rightTexture, 0);
gl.bindFramebuffer(gl.FRAMEBUFFER, mergeFramebuffer);
gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, phaseTexture, 0);
gl.bindFramebuffer(gl.FRAMEBUFFER, sampleFramebuffer);
gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, outputTexture, 0);
gl.bindFramebuffer(gl.FRAMEBUFFER, copyFramebuffer);
gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, rightTexture, 0);


//cross-bind outputs to inputs program0 renders to texture1 and vice-versa
gl.useProgram(evenProgram);
var prevLocation = gl.getUniformLocation(evenProgram, "prev");
gl.uniform1i(prevLocation, 1);
gl.activeTexture(gl.TEXTURE1);
gl.bindTexture(gl.TEXTURE_2D, rightTexture);

var outputLocation = gl.getUniformLocation(evenProgram, "lastOutput");
gl.uniform1i(outputLocation, 5);
gl.activeTexture(gl.TEXTURE5);
gl.bindTexture(gl.TEXTURE_2D, outputTexture);

gl.useProgram(oddProgram);
var prevLocation = gl.getUniformLocation(oddProgram, "prev");
gl.uniform1i(prevLocation, 0);
gl.activeTexture(gl.TEXTURE0);
gl.bindTexture(gl.TEXTURE_2D, leftTexture);

var outputLocation = gl.getUniformLocation(oddProgram, "lastOutput");
gl.uniform1i(outputLocation, 5);
gl.activeTexture(gl.TEXTURE5);
gl.bindTexture(gl.TEXTURE_2D, outputTexture);


//create and bind noise texture
//appears that 16x16 is enough for picking randomish noises
//but for thruthful mean we need more
gl.useProgram(evenProgram);
var noiseLocation = gl.getUniformLocation(evenProgram, "noise");
gl.uniform1i(noiseLocation, 2);
gl.useProgram(oddProgram);
var noiseLocation = gl.getUniformLocation(oddProgram, "noise");
gl.uniform1i(noiseLocation, 2);

gl.activeTexture(gl.TEXTURE2);
var noiseTexture = createTexture(gl);
var noise = new Float32Array(generateNoise(256*256*4));
gl.bindTexture(gl.TEXTURE_2D, noiseTexture);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 256, 0, gl.RGBA, gl.FLOAT, noise);

function generateNoise (len) {
	var res = [];
	for (var i = 0; i < len; i++) {
		res.push(Math.random());
	}
	return res;
}


//assign merge program inputs
gl.useProgram(mergeProgram);
var evenLocation = gl.getUniformLocation(mergeProgram, "even");
var oddLocation = gl.getUniformLocation(mergeProgram, "odd");
gl.uniform1i(evenLocation, 0);
gl.uniform1i(oddLocation, 1);
gl.activeTexture(gl.TEXTURE0);
gl.bindTexture(gl.TEXTURE_2D, leftTexture);
gl.activeTexture(gl.TEXTURE1);
gl.bindTexture(gl.TEXTURE_2D, rightTexture);



// create source - a simple sine
gl.useProgram(sampleProgram);
var sourceLocation = gl.getUniformLocation(sampleProgram, "source");
gl.uniform1i(sourceLocation, 3);

var sourceLen = 1024;
var source = new Float32Array(sourceLen*4);
for (var i = 0; i < sourceLen; i++) {
	source[i*4] = Math.sin( i * (Math.PI * 2) / sourceLen);
	source[i*4 + 1] = Math.sin( i * (Math.PI * 2) / sourceLen);
	source[i*4 + 2] = Math.sin( i * (Math.PI * 2) / sourceLen);
	source[i*4 + 3] = Math.sin( i * (Math.PI * 2) / sourceLen);
}
gl.activeTexture(gl.TEXTURE3);
var sourceTexture = createTexture(gl);
gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1024, 1, 0, gl.RGBA, gl.FLOAT, source);


var phaseLocation = gl.getUniformLocation(sampleProgram, "phase");
gl.uniform1i(phaseLocation, 4);
gl.activeTexture(gl.TEXTURE4);
gl.bindTexture(gl.TEXTURE_2D, phaseTexture);



//bind uniforms
var locations = {
	frequency: [],
	amplitude: [],
	quality: []
};


//setup formant values
gl.useProgram(evenProgram);
var frequencyLocation = gl.getUniformLocation(evenProgram, 'frequency');
var amplitudeLocation = gl.getUniformLocation(evenProgram, 'amplitude');
var qualityLocation = gl.getUniformLocation(evenProgram, 'quality');
locations.frequency.push(frequencyLocation);
locations.amplitude.push(amplitudeLocation);
locations.quality.push(qualityLocation);

gl.uniform1f(frequencyLocation, 440);
gl.uniform1f(qualityLocation, 0.93);


gl.useProgram(oddProgram);
var frequencyLocation = gl.getUniformLocation(oddProgram, 'frequency');
var amplitudeLocation = gl.getUniformLocation(oddProgram, 'amplitude');
var qualityLocation = gl.getUniformLocation(oddProgram, 'quality');
locations.frequency.push(frequencyLocation);
locations.amplitude.push(amplitudeLocation);
locations.quality.push(qualityLocation);

gl.uniform1f(frequencyLocation, 440);
gl.uniform1f(qualityLocation, 0.93);





//bind copy buffer
gl.useProgram(copyProgram);
var phaseLocation = gl.getUniformLocation(copyProgram, "phase");
gl.uniform1i(phaseLocation, 4);
gl.activeTexture(gl.TEXTURE4);
gl.bindTexture(gl.TEXTURE_2D, phaseTexture);




var count = 0;

/**
 * Main package function.
 * Populates passed buffer with generated data.
 *
 * @param {Array} buffer An array to fill with data
 * @param {Array} soundprint A data for the sound
 */
function populate (audioBuffer) {
	//TODO: render into 2-row buffer, each row for a channel, then just set audiobuffer channels

	var buffers = [];
	for (var i = 0; i < audioBuffer.numberOfChannels; i++) {
		buffers[i] = audioBuffer.getChannelData(i);
	}
	buffer = buffers[0];


	//copy phase into right channel before rendering
	// gl.viewport(0, 0, 3, height);
	gl.useProgram(copyProgram);
	gl.bindFramebuffer(gl.FRAMEBUFFER, copyFramebuffer);
	gl.drawArrays(gl.TRIANGLES, 0, 3);
	// gl.viewport(0, 0, width, height);


	//active even or odd program
	var even = true;

	for (var block = 0; block < blocksNumber; block++) {
		gl.useProgram(even ? evenProgram : oddProgram);
		gl.bindFramebuffer(gl.FRAMEBUFFER, even ? evenFramebuffer : oddFramebuffer);
		gl.drawArrays(gl.LINES, block * 2 * height, 2);
		// showRendered(block, even ? 0 : 1);
		even = !even;
	}


	//switch to merging program
	gl.useProgram(mergeProgram);
	gl.bindFramebuffer(gl.FRAMEBUFFER, mergeFramebuffer);
	gl.drawArrays(gl.TRIANGLES, 0, 3);
	// gl.readPixels(0, 0, width, height, gl.RGBA, gl.FLOAT, buffer.phase);


	//switch to sampling program
	gl.useProgram(sampleProgram);
	gl.bindFramebuffer(gl.FRAMEBUFFER, sampleFramebuffer);
	gl.drawArrays(gl.TRIANGLES, 0, 3);


	//read main output
	gl.readPixels(0, 0, width, height, gl.RGBA, gl.FLOAT, buffer);


	//read left/right buffers
	// audioBuffer.left = new Float32Array(buffer.length);
	// audioBuffer.right = new Float32Array(buffer.length);
	// gl.bindFramebuffer(gl.FRAMEBUFFER, evenFramebuffer);
	// gl.readPixels(0, 0, width, height, gl.RGBA, gl.FLOAT, audioBuffer.left);
	// gl.bindFramebuffer(gl.FRAMEBUFFER, oddFramebuffer);
	// gl.readPixels(0, 0, width, height, gl.RGBA, gl.FLOAT, audioBuffer.right);

	// audioBuffer.phase = new Float32Array(buffer.length);
	// gl.bindFramebuffer(gl.FRAMEBUFFER, mergeFramebuffer);
	// gl.readPixels(0, 0, width, height, gl.RGBA, gl.FLOAT, audioBuffer.phase);


	count++;

	for (var i = 1; i < audioBuffer.numberOfChannels; i++) {
		buffers[i].set(buffer);
	}

	return audioBuffer;
}


module.exports = populate;




//program (2 shaders)
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


function createTexture (gl) {
	var texture = gl.createTexture();

	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

	return texture;
}