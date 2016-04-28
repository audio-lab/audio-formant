/**
 * Pipe in formants, pipe out sound duplex stream.
 * Control the pressure of input formants based on the realtime/offline output stream.
 * They probably do calculation to current tempo based on number of samples passed.
 *
 * @module  formant-stream
 */

var createContext = require('webgl-context');
var extend = require('xtend/mutable');
var glslify = require('glslify');


module.exports = Formant;


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
	if (!(this instanceof Formant)) return new Formant(options);

	extend(this, options);

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
		phase: [createTexture(gl), createTexture(gl)],
		output: createTexture(gl)
	};

	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, this.textures.phase[0]);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.blockSize/4, this.formants, 0, gl.RGBA, gl.FLOAT, null);

	gl.activeTexture(gl.TEXTURE1);
	gl.bindTexture(gl.TEXTURE_2D, this.textures.phase[1]);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.blockSize/4, this.formants, 0, gl.RGBA, gl.FLOAT, null);

	gl.activeTexture(gl.TEXTURE2);
	gl.bindTexture(gl.TEXTURE_2D, this.textures.formants);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.blockSize, this.formants, 0, gl.RGBA, gl.FLOAT, null);

	gl.activeTexture(gl.TEXTURE3);
	gl.bindTexture(gl.TEXTURE_2D, this.textures.noise);
	this.updateNoise();

	gl.activeTexture(gl.TEXTURE4);
	gl.bindTexture(gl.TEXTURE_2D, this.textures.source);
	this.initSource();

	gl.activeTexture(gl.TEXTURE5);
	gl.bindTexture(gl.TEXTURE_2D, this.textures.output);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.blockSize/4, this.channels, 0, gl.RGBA, gl.FLOAT, null);


	//init framebuffers
	this.framebuffers = {
		//phases are rendered in turn to keep previous state
		phase: [
			gl.createFramebuffer(),
			gl.createFramebuffer()
		],
		merge: gl.createFramebuffer()
	};

	gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers.phase[0]);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.textures.phase[0], 0);

	gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers.phase[1]);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.textures.phase[1], 0);

	gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers.merge);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.textures.output, 0);


	//init programs
	this.programs = {
		phase: createProgram(gl, glslify('./rect.glsl'), glslify('./phase.glsl')),
		merge: createProgram(gl, glslify('./rect.glsl'), glslify('./merge.glsl'))
	};

	var buffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,-1,3,3,-1]), gl.STATIC_DRAW);
	gl.enableVertexAttribArray(0);
	gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
	gl.bindAttribLocation(this.programs.phase, 0, 'position');
	gl.bindAttribLocation(this.programs.merge, 0, 'position');

	gl.linkProgram(this.programs.phase);
	gl.linkProgram(this.programs.merge);

	//save locations
	this.locations = {
		phase: {},
		merge: {}
	};

	this.locations.phase.formants = gl.getUniformLocation(this.programs.phase, 'formants');
	this.locations.phase.noise = gl.getUniformLocation(this.programs.phase, 'noise');
	this.locations.phase.phase = gl.getUniformLocation(this.programs.phase, 'phase');
	this.locations.phase.sampleRate = gl.getUniformLocation(this.programs.phase, 'sampleRate');
	this.locations.phase.width = gl.getUniformLocation(this.programs.phase, 'width');
	this.locations.phase.height = gl.getUniformLocation(this.programs.phase, 'height');

	this.locations.merge.phase = gl.getUniformLocation(this.programs.merge, 'phase');
	this.locations.merge.sampleRate = gl.getUniformLocation(this.programs.merge, 'sampleRate');
	this.locations.merge.width = gl.getUniformLocation(this.programs.merge, 'width');
	this.locations.merge.height = gl.getUniformLocation(this.programs.merge, 'height');

	//bind uniforms
	gl.useProgram(this.programs.phase);
	gl.uniform1i(this.locations.phase.formants, 2);
	gl.uniform1i(this.locations.phase.noise, 3);
	gl.uniform1f(this.locations.phase.sampleRate, this.sampleRate);
	gl.uniform1f(this.locations.phase.width, this.blockSize);
	gl.uniform1f(this.locations.phase.height, this.formants);

	gl.useProgram(this.programs.merge);
	gl.uniform1i(this.locations.merge.source, 4);
	gl.uniform1f(this.locations.merge.sampleRate, this.sampleRate);
	gl.uniform1f(this.locations.merge.width, this.blockSize);
	gl.uniform1f(this.locations.merge.height, this.formants);

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
Formant.prototype.noiseWidht = 512;
Formant.prototype.noiseHeight = 512;


/**
 * Number of formants to process
 */
Formant.prototype.formants = 4;


/**
 * Set formants data.
 * Use mostly for demo/test purposes.
 * In production it is faster to render straight to `textures.formants`
 */
Formant.prototype.setFormants = function (data) {
	if (data.length/4 !== this.formants) throw Error('Formants data size should correspond to number of formants: ' + this.formants);

	gl.bindTexture(gl.TEXTURE_2D, this.textures.formants);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, this.formants, 0, gl.RGBA, gl.FLOAT, data);
};



/**
 * Update noise texture.
 * Call if feel need to updating noise.
 */
Formant.prototype.updateNoise = function () {
	var w = this.noiseWidht, h = this.noiseHeight;
	var gl = this.gl;

	gl.bindTexture(gl.TEXTURE_2D, this.textures.noise);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.FLOAT, generateNoise(w, h));

	return this;
};


/**
 * Fill source texture with values of data,
 * or sine if data is omitted
 */
Formant.prototype.initSource = function (data) {
	var gl = this.gl;

	var sourceLen;

	if (!data) {
		var sourceLen = 1024;
		data = new Float32Array(1024);

		for (var i = 0; i < sourceLen; i++) {
			data[i] = Math.sin( i * (Math.PI * 2) / sourceLen);
		}
	}
	else {
		sourceLen = data.length;
	}

	gl.bindTexture(gl.TEXTURE_2D, this.textures.source);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, sourceLen/4, 1, 0, gl.RGBA, gl.FLOAT, data);

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
	gl.useProgram(this.programs.phase);
	gl.uniform1i(this.locations.phase.phase, this.activePhase);
	gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers.phase[currentPhase]);
	gl.drawArrays(gl.TRIANGLES, 0, 3);

	//sample rendered phases and distribute to channels
	gl.useProgram(this.programs.merge);
	gl.uniform1i(this.locations.merge.phase, currentPhase);
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
			prev = data[j*w + i] = (prev + Math.random()) % 1;
		}
	}

	return data;
};