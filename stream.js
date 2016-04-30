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


//TODO: render channels to 2-row output.
//TODO: do averaging in shader, merging multiple sines
//TODO: use drawElements to reference existing vertex coords instead. That is tiny-piny but optimization, esp for large number of rows.
//TODO: set sound source sprite, set fractions for basic sources. Do not expect source texture be repeating, repeat manually.
//TODO: optimization: put 0 or 1 quality values to big-chunks processing (no need to calc sequences for them)
//TODO: cache noise sequences to avoid varyings chunking




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
	uniform sampler2D phase;

	const float width = ${this.blockSize/4}.;
	const float height = ${this.formants}.;
	const float sampleRate = ${this.sampleRate}.;

	float getStep (float f) {
		return f / sampleRate;
	}

	void main (void) {
		vec2 coord = floor(gl_FragCoord.xy);
		vec2 xy = vec2(gl_FragCoord.x / width, gl_FragCoord.y / height);

		float range = 1000.;
		float lastSample = texture2D(phase, vec2( (width - 0.5) / width, xy.y)).w;

		vec4 sample, formant;

		//512x4 is 4096 — pretty much for buffer, but i < width
		for (float i = 0.; i < width; i++) {
			//TODO: read 4 formants
			formant = texture2D(formants, vec2( i / width, xy.y));

			sample = texture2D(noise, vec2( i / width, xy.y));

			float frequency = 440.;

			sample.x = fract( getStep(frequency + sample.x*range - range*0.5) + lastSample);
			sample.y = fract( getStep(frequency + sample.y*range - range*0.5) + sample.x);
			sample.z = fract( getStep(frequency + sample.z*range - range*0.5) + sample.y);
			sample.w = fract( getStep(frequency + sample.w*range - range*0.5) + sample.z);

			lastSample = sample.w;

			if (coord.x == i) {
				gl_FragColor = sample;
				break;
			}
		}
	}`;

	//sample input phases and merge waveforms, distributing by channels
	var mergeSrc = `
	precision ${this.precision} float;

	uniform sampler2D phase;
	uniform sampler2D source;
	uniform sampler2D formants;

	const float width = ${this.blockSize/4}.;
	const float height = ${this.formants}.;
	const float sampleRate = ${this.sampleRate}.;
	const float channels = ${this.channels}.;

	void main () {
		vec2 xy = vec2(gl_FragCoord.x / width, gl_FragCoord.y / height);

		vec4 phaseValue = texture2D(phase, vec2(gl_FragCoord.x / width, 0));

		gl_FragColor = vec4(
			texture2D(source, vec2(phaseValue.x, 0))[${this.waveform}],
			texture2D(source, vec2(phaseValue.y, 0))[${this.waveform}],
			texture2D(source, vec2(phaseValue.z, 0))[${this.waveform}],
			texture2D(source, vec2(phaseValue.w, 0))[${this.waveform}]
		);
	}`;


	//init programs
	this.programs = {
		phase: createProgram(gl, rectSrc, phaseSrc),
		merge: createProgram(gl, rectSrc, mergeSrc)
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

	this.locations.merge.phase = gl.getUniformLocation(this.programs.merge, 'phase');
	this.locations.merge.source = gl.getUniformLocation(this.programs.merge, 'source');
	this.locations.merge.formants = gl.getUniformLocation(this.programs.merge, 'formants');

	//bind uniforms
	gl.useProgram(this.programs.phase);
	gl.uniform1i(this.locations.phase.formants, 2);
	gl.uniform1i(this.locations.phase.noise, 3);

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
	var w = this.blockSize, h = this.formants;

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
	gl.useProgram(this.programs.phase);
	gl.uniform1i(this.locations.phase.phase, this.activePhase);
	gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers.phase[currentPhase]);
	gl.drawArrays(gl.TRIANGLES, 0, 3);

	buffer.phase = new Float32Array(this.formants * this.blockSize);
	gl.readPixels(0, 0, this.blockSize/4, this.formants, gl.RGBA, gl.FLOAT, buffer.phase);

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
			prev = data[j*w*4 + i*4] = (prev + Math.random()) % 1;
			prev = data[j*w*4 + i*4+1] = (prev + Math.random()) % 1;
			prev = data[j*w*4 + i*4+2] = (prev + Math.random()) % 1;
			prev = data[j*w*4 + i*4+3] = (prev + Math.random()) % 1;
		}
	}

	return data;
};