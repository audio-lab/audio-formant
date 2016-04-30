/**
 * To render long buffers we should have:
 * - inner state with the last offset
 * - two shaders ping ponging textures to avoid readpixels
 */


var createContext = require('webgl-context');


//default buffer size to render (in pixels)
var width = 512/4;
var height = 512;

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


//enable requried extensions
var float = gl.getExtension('OES_texture_float');
if (!float) throw Error('WebGL does not support floats.');
var floatLinear = gl.getExtension('OES_texture_float_linear');
if (!floatLinear) throw Error('WebGL does not support floats.');


var fSrc = `
	precision lowp float;

	uniform sampler2D formant;
	uniform sampler2D noise;
	uniform sampler2D source;
	uniform float frequency;

	uniform float last;

	float getStep (float f) {
		return f / ${ sampleRate }.;
	}

	void main (void) {
		vec2 coord = floor(gl_FragCoord.xy);

		float range = 1000.;

		float lastSample = 0.0;

		vec4 sample;

		for (int idx = 0; idx < ${width}; idx++) {
			float i = float(idx);

			sample = texture2D(noise, vec2( i / ${width}., 0));

			sample.x = fract( getStep(frequency + sample.x*range - range*0.5) + lastSample);
			sample.y = fract( getStep(frequency + sample.y*range - range*0.5) + sample.x);
			sample.z = fract( getStep(frequency + sample.z*range - range*0.5) + sample.y);
			sample.w = fract( getStep(frequency + sample.w*range - range*0.5) + sample.z);

			lastSample = sample.w;

			if (coord.x == i) {
				gl_FragColor = vec4(
					texture2D(source, vec2(sample.x, 0)).x,
					texture2D(source, vec2(sample.y, 0)).x,
					texture2D(source, vec2(sample.z, 0)).x,
					texture2D(source, vec2(sample.w, 0)).x
				);
				break;
			}
		}
	}
`;

var vRectSrc = `
	attribute vec2 position;

	void main () {
		gl_Position = vec4(position, 0, 1);
	}
`;

//generate formant phases texture
var sampleProgram = createProgram(gl, vRectSrc, fSrc);

//save last phase values for the next run
var copyProgram = createProgram(gl, vRectSrc, `
	precision lowp float;

	uniform sampler2D phase;

	void main () {
		gl_FragColor = texture2D(phase, vec2(${width-1}. / ${width}., gl_FragCoord.y / ${height}.));
	}
`);




//create merging shader a-big-triangle output
var buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,-1,3,3,-1]), gl.STATIC_DRAW);
gl.enableVertexAttribArray(2)
gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);
gl.bindAttribLocation(sampleProgram, 2, 'position');
gl.bindAttribLocation(copyProgram, 2, 'position');


//relink program after binding attribs
gl.linkProgram(sampleProgram);
gl.linkProgram(copyProgram);



//create main framebuffers
var sampleFramebuffer = gl.createFramebuffer(); //sample phase
var copyFramebuffer = gl.createFramebuffer(); //copy


//create main textures
var outputTexture = createTexture(gl);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.FLOAT, null);


//bind output textures to framebuffers
gl.bindFramebuffer(gl.FRAMEBUFFER, sampleFramebuffer);
gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, outputTexture, 0);

// gl.bindFramebuffer(gl.FRAMEBUFFER, copyFramebuffer);
// gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, rightTexture, 0);


//create and bind noise texture
//appears that 16x16 is enough for picking randomish noises
//but for thruthful mean we need more
gl.useProgram(sampleProgram);
var noiseLocation = gl.getUniformLocation(sampleProgram, "noise");
gl.uniform1i(noiseLocation, 2);

gl.activeTexture(gl.TEXTURE2);
var noiseTexture = createTexture(gl);
var noise = new Float32Array(generateNoise(512*512*4));
gl.bindTexture(gl.TEXTURE_2D, noiseTexture);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 512, 512, 0, gl.RGBA, gl.FLOAT, noise);

function generateNoise (len) {
	var res = [];
	for (var i = 0; i < len; i++) {
		res.push(Math.random());
	}
	return res;
}


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




var frequencyLocation = gl.getUniformLocation(sampleProgram, 'frequency');

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
	// gl.drawArrays(gl.TRIANGLES, 0, 3);


	//switch to sampling program
	gl.useProgram(sampleProgram);
	gl.bindFramebuffer(gl.FRAMEBUFFER, sampleFramebuffer);
	gl.drawArrays(gl.TRIANGLES, 0, 3);


	//read main output
	gl.readPixels(0, 0, width, 1, gl.RGBA, gl.FLOAT, buffer);

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