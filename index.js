/**
 * To render long buffers we should have:
 * - inner state with the last offset
 * - two shaders ping ponging textures to avoid readpixels
 */


var createContext = require('webgl-context');
var createShader = require('gl-shader-core');
var glslify = require('glslify');


//TODO: add real/fake noise flag to use real noise
//TODO: use multiple buffers outputs for multiple channels?
//TODO: it should be a class, because it has to store last offset value
//TODO: do averaging in shader

//default buffer size to render
var width = 512;
var height = 1;

//single-slice width
//vp width is a bit more than renderable window (VARYINGS) to store offsets at the end
var vpWidth = 32;

//number of varyings to use, max - 29
var VARYINGS = 29;

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


//enable requried extensions
var float = gl.getExtension('OES_texture_float');
if (!float) throw Error('WebGL does not support floats.');
var floatLinear = gl.getExtension('OES_texture_float_linear');
if (!floatLinear) throw Error('WebGL does not support floats.');
// var bufs = gl.getExtension('WEBGL_draw_buffers');
// if (!bufs) throw Error('WebGL does not support floats.');




var vSrc = function (isEven, VARYINGS) { return `
	precision highp float;

	//coords of a vertex
	attribute vec2 position;

	//source wave
	uniform sampler2D source;

	//noise samples
	uniform sampler2D noise;

	//size of generated noise steps
	uniform float frequency;

	//variance of generated noise steps
	uniform float quality;

	//noise accumulator to pick values from the source texture
	varying vec4 samples[${VARYINGS}];

	//generate samples
	void main (void) {
		gl_Position = vec4(position, 0, 1);

		//TODO: step is how many samples we should skip in texture to obtain needed frequency

		float offset = 0.0;
		vec4 sample;

		//FIXME: extra 3 calculations here, for each vertex. Use it.
		for (int i = 0; i < ${VARYINGS}; i++) {
			//noise step from last sample
			// sample = texture2D(noise, vec2(float(i) / (${VARYINGS}.0 - 1.0), 0) );

			sample = vec4(0.02);

			sample.x = fract(offset + sample.x);
			sample.y = fract(sample.y + sample.x);
			sample.z = fract(sample.z + sample.y);
			sample.w = fract(sample.w + sample.z);

			//save last offset
			offset = sample.w;

			samples[i] = sample;
		}
	}
`; }

var fSrc = function (isEven, VARYINGS) { return `
	precision highp float;

	//sound source texture
	uniform sampler2D source;

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

		//relative x coordinate, innser offset within the viewport
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
		vec2 offsetCoord = vec2( start / ${width - 1}., 0);
		float offset = texture2D(prev, offsetCoord).w;

		//get sound source position
		vec4 pos = fract(getSample(idx) + offset);

		//render 4 waveform samples
		//FIXME: 3 channels of the source texture are empty
		//FIXME: y-position of the texture is unused

		if (idx < ${VARYINGS}) {
			gl_FragColor = vec4(
				texture2D(source, vec2(pos.x, 0)).x,
				texture2D(source, vec2(pos.y, 0)).x,
				texture2D(source, vec2(pos.z, 0)).x,
				texture2D(source, vec2(pos.w, 0)).x
			);
		}

		//if x is more than ${VARYINGS} - just save the last offset value.
		//anyways we have to render pow2 textures, but we don’t have enough varyings.
		else {
			gl_FragColor = vec4(pos.w);
		}
	}
`;}

//main shader generating sound row
var programs = [
	//even step renderer
	createProgram(gl, vSrc(true, VARYINGS), fSrc(true, VARYINGS)),

	//odd step renderer
	createProgram(gl, vSrc(false, VARYINGS), fSrc(false, VARYINGS)),

	//final merger - takes two textures and renders into a single one
	createProgram(gl, `
		attribute vec2 position;

		void main () {
			gl_Position = vec4(position, 0, 1);
		}
	`, `
		precision lowp float;

		uniform sampler2D even;
		uniform sampler2D odd;

		bool isEven(float x) {
			return mod(x, 2.0) == 0.0;
		}

		void main () {
			float w = ${width - 1}.;
			float x = floor(gl_FragCoord.x);
			float innerOffset = mod(x, ${VARYINGS}.);
			float outerOffset = floor(x / ${VARYINGS}.);

			if (isEven(outerOffset)) {
				gl_FragColor = texture2D(even, vec2(x / w, 0));
			} else {
				gl_FragColor = texture2D(odd, vec2(x / w, 0));
			}
		}
	`)
];



//create input buffer with number of verteces === height
var buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(createVerteces(height)), gl.STATIC_DRAW);
gl.enableVertexAttribArray(1)
//index, size, type, normalized, stride, offset (pointer)
gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
gl.bindAttribLocation(programs[0], 1, 'position');
gl.bindAttribLocation(programs[1], 1, 'position');

function createVerteces (n) {
	var res = [];
	var last = 1;
	var step = 2 / n;
	for (var i = 0; i < n; i++) {
		res.push(-1);
		res.push(last);
		res.push(15);
		res.push(last);
		last -= step;
		res.push(-1);
		res.push(last);
	}
	return res;
}

//create merging shader a-big-triangle output
var buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,-1,3,3,-1]), gl.STATIC_DRAW);
gl.enableVertexAttribArray(2)
gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);
gl.bindAttribLocation(programs[2], 2, 'position');



//relink program after binding attribs
gl.linkProgram(programs[0]);
gl.linkProgram(programs[1]);
gl.linkProgram(programs[2]);



//create main output framebuffer
var framebuffers = [
	gl.createFramebuffer(),
	gl.createFramebuffer(),
	gl.createFramebuffer()
];

var outputTextures = [
	//left shader output
	gl.createTexture(),
	//right shader output
	gl.createTexture(),
	//merging shader output
	gl.createTexture()
];

//create output textures
gl.bindTexture(gl.TEXTURE_2D, outputTextures[0]);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.FLOAT, null);
gl.bindTexture(gl.TEXTURE_2D, outputTextures[1]);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.FLOAT, null);
gl.bindTexture(gl.TEXTURE_2D, outputTextures[2]);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.FLOAT, null);

//bind output textures to framebuffers
gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffers[0]);
gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, outputTextures[0], 0);
gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffers[1]);
gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, outputTextures[1], 0);
gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffers[2]);
gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, outputTextures[2], 0);

//cross-bind outputs to inputs program0 renders to texture1 and vice-versa
gl.useProgram(programs[0]);
var prevLocation = gl.getUniformLocation(programs[0], "prev");
gl.uniform1i(prevLocation, 0);
gl.activeTexture(gl.TEXTURE0);
gl.bindTexture(gl.TEXTURE_2D, outputTextures[1]);
gl.useProgram(programs[1]);
var prevLocation = gl.getUniformLocation(programs[1], "prev");
gl.uniform1i(prevLocation, 1);
gl.activeTexture(gl.TEXTURE1);
gl.bindTexture(gl.TEXTURE_2D, outputTextures[0]);

//bind shaders outputs to merging shader input
gl.useProgram(programs[2]);
var evenLocation = gl.getUniformLocation(programs[2], "even");
var oddLocation = gl.getUniformLocation(programs[2], "odd");
gl.uniform1i(evenLocation, 1);
gl.uniform1i(oddLocation, 0);


//define locations of uniforms
gl.useProgram(programs[0]);
var sourceLocation = gl.getUniformLocation(programs[0], "source");
var noiseLocation = gl.getUniformLocation(programs[0], "noise");
gl.uniform1i(sourceLocation, 2);
gl.uniform1i(noiseLocation, 3);
gl.useProgram(programs[1]);
var sourceLocation = gl.getUniformLocation(programs[1], "source");
var noiseLocation = gl.getUniformLocation(programs[1], "noise");
gl.uniform1i(sourceLocation, 2);
gl.uniform1i(noiseLocation, 3);


//create source - a simple sine
var sourceLen = 512;
var source = new Float32Array(sourceLen*4);
for (var i = 0; i < sourceLen; i++) {
	source[i*4] = Math.sin( i * (Math.PI * 2) / sourceLen);
	source[i*4 + 1] = Math.sin( i * (Math.PI * 2) / sourceLen);
	source[i*4 + 2] = Math.sin( i * (Math.PI * 2) / sourceLen);
	source[i*4 + 3] = Math.sin( i * (Math.PI * 2) / sourceLen);
}
var sourceTexture = gl.createTexture();
gl.activeTexture(gl.TEXTURE2);
gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 512, 1, 0, gl.RGBA, gl.FLOAT, source);


//create noise texture
var noise = new Float32Array(generateNoise(512*4));
var noiseTexture = gl.createTexture();
gl.activeTexture(gl.TEXTURE3);
gl.bindTexture(gl.TEXTURE_2D, noiseTexture);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 512, 1, 0, gl.RGBA, gl.FLOAT, noise);

function generateNoise (len) {
	var res = [];
	for (var i = 0; i < len; i++) {
		res.push(Math.random());
	}
	return res;
}





//bind uniforms
programs.forEach(function (program) {
	gl.useProgram(program);

	var frequencyLocation = gl.getUniformLocation(program, 'frequency');
	var amplitudeLocation = gl.getUniformLocation(program, 'amplitude');
	var qualityLocation = gl.getUniformLocation(program, 'quality');

	gl.uniform1f(frequencyLocation, 1);
	gl.uniform1f(amplitudeLocation, 1);
	gl.uniform1f(qualityLocation, 1);
});







//active state
var active = 0;


/**
 * Main package function.
 * Populates passed buffer with generated data.
 *
 * @param {Array} buffer An array to fill with data
 * @param {Array} soundprint A data for the sound
 */
function populate (buffer) {
	for (var vpOffset = 0; vpOffset < width; vpOffset += VARYINGS) {
		gl.viewport(vpOffset, 0, vpWidth, height);
		gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffers[active]);
		gl.useProgram(programs[active]);

		gl.drawArrays(gl.TRIANGLES, 0, 3*height);

		active = (active + 1) % 2;
	}


	//switch to merging buffer
	gl.viewport(0, 0, width, height);
	gl.useProgram(programs[2]);
	gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffers[2]);
	gl.drawArrays(gl.TRIANGLES, 0, 3);

	gl.readPixels(0, 0, width, height, gl.RGBA, gl.FLOAT, buffer);

	buffer.left = new Float32Array(buffer.length);
	buffer.right = new Float32Array(buffer.length);

	gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffers[0]);
	gl.readPixels(0, 0, width, height, gl.RGBA, gl.FLOAT, buffer.left);
	gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffers[1]);
	gl.readPixels(0, 0, width, height, gl.RGBA, gl.FLOAT, buffer.right);

	return buffer;
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