/**
 * Pipe in formants, pipe out sound duplex stream.
 * Control the pressure of input formants based on the realtime/offline output stream.
 * They probably do calculation to current tempo based on number of samples passed.
 *
 * @module  formant-stream
 */

var createContext = require('webgl-context');
var extend = require('xtend/mutable');
var pcmUtil = require('pcm-util');
var glslify = require('glslify');


//TODO: render channels to 2-row output.
//TODO: do averaging in shader, merging multiple sines
//TODO: use drawElements to reference existing vertex coords instead. That is tiny-piny but optimization, esp for large number of rows.
//TODO: set sound source sprite, set fractions for basic sources. Do not expect source texture be repeating, repeat manually.
//TODO: optimization: put 0 or 1 quality values to big-chunks processing (no need to calc sequences for them)
//TODO: place large waveform formants to merge stage, do not chunk-process them
//TODO: cache noise sequences to avoid varyings chunking


/**
 * @constructor
 */
function Formant (options) {
	extend(this, options);

	this.initGl();
	this.initNoise();


	this.textures = {
		formants: createTexture(this.gl),
		noise: createTexture(this.gl),
		source: createTexture(this.gl),
		phase: createTexture(this.gl),
		waveforms: createTexture(this.gl),
		output: createTexture(this.gl)
	};


	this.framebuffers = {
		phase,
		merge,
		copy
	};

	this.programs = {
		phase: createProgram(this.gl, glslify('./shader/rect.vert'), glslify('./shader/phase.frag')),
		merge,
		copy
	};
}


//sampleRate, channels, samplesPerFrame are primary concern
extend(Formant.prototype, pcmUtil.defaults);


/**
 * Init gl context
 */
Formant.prototype.initGl = function () {
	if (!this.gl) {
		this.gl = createContext({
			width: this.width,
			height: this.height
		});
	}

	// micro optimizations
	this.gl.disable(this.gl.DEPTH_TEST);
	this.gl.disable(this.gl.BLEND);
	this.gl.disable(this.gl.CULL_FACE);
	this.gl.disable(this.gl.DITHER);
	this.gl.disable(this.gl.POLYGON_OFFSET_FILL);
	this.gl.disable(this.gl.SAMPLE_COVERAGE);
	this.gl.disable(this.gl.SCISSOR_TEST);
	this.gl.disable(this.gl.STENCIL_TEST);


	//enable requried extensions
	var float = this.gl.getExtension('OES_texture_float');
	if (!float) throw Error('WebGL does not support floats.');
	var floatLinear = this.gl.getExtension('OES_texture_float_linear');
	if (!floatLinear) throw Error('WebGL does not support floats.');
};


/**
 * Populates passed buffer with audio data separated by channels
 */
Formant.prototype.populate = function (buffer) {
	this.gl.useProgram(this.programs.copy);
	this.gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers.copy);
	this.gl.re
};


/**
 * Initialize additive noise textures.
 */
//TODO: optimize this part, too many things can be done in parallel
Formant.prototype.generateNoise = function (w, h) {
	var w = 512, h = 512;
	var data = new Float32Array(w*h);

	for (var j = 0; j < h; j++) {
		var prev = 0;

		//fill rows with random sequence of phase
		for (var i = 0; i < w; i++) {
			prev = data[j*w + i] = (prev + Math.random()) % 1;
		}
	}

	return data;
};


/**
 * Set new formants state to render
 */
Formant.prototype.setFormants = function (tuple) {

}


/**
 * Send new source texture to GPU
 */
Formant.prototype.setSource = function (arr) {

}



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

	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

	return texture;
}