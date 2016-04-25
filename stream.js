/**
 * Pipe in formants, pipe out sound duplex stream.
 * Control the pressure of input formants based on the realtime/offline output stream.
 * They probably do calculation to current tempo based on number of samples passed.
 *
 * @module  formant-stream
 */

var createContext = require('webgl-context');


//TODO: name it formant-sound. literally is does that - converts formants to sound.
//TODO: add real/fake noise flag to use real noise
//TODO: render channels to 2-row output.
//TODO: it should be a class, because it has to store last offset value
//TODO: do averaging in shader, merging multiple sines
//TODO: use drawElements to reference existing vertex coords instead. That is tiny-piny but optimization, esp for large number of rows.
//TODO: instead of switching viewport render subset of verteces for a long chunk. That is faster (in theory) and allows for binding formant values to buffers.
//TODO: set sound source sprite, set fractions for basic sources. Do not expect source texture be repeating, repeat manually.


/**
 * @constructor
 */
function FormantSound (options) {
	Object.assign(this, options);

	this.initGl();
	this.initNoise();
}

//default buffer size to render (in pixels)
FormantSound.prototype.width = 512/4;

//number of formants to render
FormantSound.prototype.height = 1;

//number of output channels === number of rows.
FormantSound.prototype.channels = 2;

//default sample rate to render to
FormantSound.prototype.sampleRate = 44100;

//single-slice width
//vp width is a bit more than renderable window (VARYINGS) to store offsets at the end
//FIXME: calc based on varyings size
FormantSound.prototype.blockSize = 32;

//number of varyings to use, max - 29
//TODO: detect it from the gl instance
FormantSound.prototype.varyings = 29;


//sound sources texture
FormantSound.prototype.source = [];


/**
 * Init gl context
 */
FormantSound.prototype.initGl = function () {
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
	// var bufs = this.gl.getExtension('WEBGL_draw_buffers');
	// if (!bufs) throw Error('WebGL does not support floats.');
};


/**
 * Populates passed buffer with formant state
 */
FormantSound.prototype.populate = function (buffer) {
	//for each Nth frame update noise source
	if (this.frame % this.refreshNoiseRate) {
		this.initNoise();
	}
};


/**
 * Init noise texture
 */
FormantSound.prototype.initNoise = function () {

};


/**
 * Return array with noise items
 */
FormantSound.prototype.generateNoise = function (arr) {
	var res = [];
	for (var i = 0; i < len; i++) {
		res.push(Math.random());
	}
	return res;
}


/**
 * Set new formants state to render
 */
FormantSound.prototype.setFormants = function (tuple) {

}


/**
 * Send new source texture to GPU
 */
FormantSound.prototype.setSource = function (arr) {

}



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