var test = require('tst');
var Speaker = require('audio-speaker');
var AudioBuffer = require('audio-buffer');
var util = require('audio-buffer-utils');
var createFormant = require('../');
var ctx = require('audio-context');
var Through = require('audio-through');
var fps = require('fps-indicator')();


test('Draw', function () {
	var formant = createFormant({
		formants: [1/440, 1, 0.2, 0],//[1/220,1,0.5,0, 1/220,0,0.5,0, 1/880,0,0.5,0, 0.5/440,0,0.5,0],
		waveform: 0
	});

	var buffer = formant.populate();
	var buffer2 = formant.populate();
	var buffer3 = formant.populate();
	var buffer4 = formant.populate();
	// console.log(buffer[buffer.length - 1], buffer2[0]);

	// show(buffer.phases, 512, 4);
	show(buffer3, 512, 2);
	show(buffer4, 512, 2);

	// show(buffer.left, 512, 1);
	// show(buffer.right, 512, 1);
	// show(buffer.phase, 512, 1);
	showWaveform(
		[].slice.call(buffer, 0, buffer.length/2).concat(
		[].slice.call(buffer2, 0, buffer2.length/2))
	);
});


test('Performance', function () {
	var formant = createFormant({
		formants: 32
	});
	// var populate = require('./index2.js');
	//Collect performance metrics to render 1s of a sound.

	//Results
	//1. Triangle verteces, viewport shift ~130ms
	//2. Line verteces, viewport shift ~130ms
	//3. Line verteces, drawArrays subsetting ~120ms
	//This is almost no difference. We get rid of re-setting viewport,
	//but each render it still checks for whether verteces intersect viewport.
	//4. A big triangle of seq calc by each fragment ~90ms
	//almost equal to idle run.
	//Parallel things are like one longest thing, worry about only lenghten calc
	//within all parallel threads.
	//5. For big data sets, like 256+ formants, parallel things seems to start queueing,
	//so per-pixel handler takes 400ms whereas varyings only 200ms :(

	var arr = new Float32Array(512*4*4);
	var buf = new AudioBuffer(512);

	test('1s of one sine', function () {
		for (var i = 0; i < 44100/512; i++) {
			formant.populate();
		}
	});
});


test.only('Sound', function (done) {
	var formant = createFormant({
		formants: [
			1/440,1,0.4,0//, 1/440,1,0.9,0, 1/880,1,0.9,0, 0.5/880,1,0.9,0
		],
		waveform: 0,
		blockSize: 512
	})

	Through(function (buffer) {
		var res = formant.populate();
		var len = this.samplesPerFrame;

		for (var channel = 0; channel < buffer.numberOfChannels; channel++) {
			var data = res.slice(channel * len, channel * len + len);

			buffer.copyToChannel(data, channel);
		}

		if (this.time > 4) this.end();

		return buffer;
	}, {samplesPerFrame: 512}).pipe(Speaker({
		samplesPerFrame: 512
	}));

	setTimeout(function () {
		done();
	}, 1000);
});



function show (pixels, w, h) {
	// var pixels = new Float32Array(w * h * 4);
	// gl.readPixels(0, 0, w, h, gl.RGBA, gl.FLOAT, pixels);

	var canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	var ctx = canvas.getContext('2d');
	var imageData = ctx.createImageData(w, h);

	pixels.forEach(function (x, i) {
		imageData.data[i*4] = (x*0.5 + 0.5)*255;
		imageData.data[i*4+1] = (x*0.5 + 0.5)*255;
		imageData.data[i*4+2] = (x*0.5 + 0.5)*255;
		imageData.data[i*4+3] = 255;
	});

	ctx.putImageData(imageData, 0, 0);
	document.body.appendChild(canvas);
}


//last painted wf offset
var offset = 0;

function showWaveform (buffer) {
	var wfCanvas = document.createElement('canvas');
	wfCanvas.width = 800;
	wfCanvas.height = 300;
	var wfCtx = wfCanvas.getContext('2d');
	document.body.appendChild(wfCanvas);


	var len = buffer.length;

	wfCtx.clearRect(0, 0, wfCanvas.width, wfCanvas.height);

	var amp = wfCanvas.height / 2;


	var step = 1;
	var middle = amp;

	wfCtx.beginPath();
	wfCtx.moveTo(0, middle);

	for (var i = 0; i < len; i++) {
		var sampleNumber = (step * i)|0;
		var sample = buffer[sampleNumber];

		wfCtx.lineTo(i, -sample * amp + middle);
		wfCtx.lineTo(i + 1, -sample * amp + middle);
	}

	wfCtx.stroke();
}



//create grid
function createGrid () {
	document.body.style.position = 'relative';
	for (var i = 0; i < 20; i++) {
		var el = document.createElement('div');
		el.style.left = `${i*32}px`;
		el.style.position = 'absolute';
		el.style.top = 0;
		el.style.background = 'rgba(0,0,0,.1)';
		el.style.width = '1px';
		el.style['z-index'] = -1;
		el.style.height = '12px';
		document.body.appendChild(el);
		el.innerHTML = i*32;
		el.style.fontSize = '8px';
		el.style.fontFamily = 'sans-serif';
		el.style.color = 'rgba(220,220,220,1)';
	}
	for (var i = 0; i < 21; i++) {
		var el = document.createElement('div');
		el.style.left = `${i*25}px`;
		el.style.position = 'absolute';
		el.style.bottom = '-8px';
		el.style.background = 'rgba(255,0,0,.1)';
		el.style.width = '1px';
		el.style['z-index'] = -1;
		el.style.height = '12px';
		document.body.appendChild(el);
		el.innerHTML = i*25;
		el.style.fontSize = '8px';
		el.style.fontFamily = 'sans-serif';
		el.style.color = 'rgba(2255,220,220,1)';
	}
}
createGrid();
