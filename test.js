var test = require('tst');
var populate = require('./');
var Speaker = require('audio-speaker');
var Through = require('audio-through');
var AudioBuffer = require('audio-buffer');
var util = require('audio-buffer-utils');


test.only('Just draw one slice', function () {
	var buffer = populate(new AudioBuffer(512)).getChannelData(0);

	// show(buffer.left, 512, 1);
	// show(buffer.right, 512, 1);
	// show(buffer.phase, 512, 1);
	show(buffer, 512, 1);


	var buffer2 = populate(new AudioBuffer(512)).getChannelData(0);

	// show(buffer.left, 512, 1);
	// show(buffer.right, 512, 1);
	// show(buffer.phase, 512, 1);
	show(buffer2, 512, 1);
	showWaveform([].slice.apply(buffer).concat([].slice.apply(buffer2)));


	var buffer = populate(new AudioBuffer(512)).getChannelData(0);
	show(buffer, 512, 1);
	// showWaveform(buffer);
	var buffer = populate(new AudioBuffer(512)).getChannelData(0);
	show(buffer, 512, 1);
	// showWaveform(buffer);
	var buffer = populate(new AudioBuffer(512)).getChannelData(0);
	show(buffer, 512, 1);
	// showWaveform(buffer);
});


test('Performance', function () {
	//Collect performance metrics to render 1s of a sound.

	//Results
	//1. Triangle verteces, viewport shift ~130ms
	//2. Line verteces, viewport shift

	var buf = new AudioBuffer(512);

	test('Run', function () {
		for (var i = 0; i < 44100/512; i++) {
			populate(buf);
		}
	});
});


test('Basic sound', function () {
	var faq = [0.5, 1, 1, 1];

	var data = [];
	Through(function (buffer) {
		// if (this.frame > 2) return null;
		populate(buffer);
		data.push(buffer);

		// var self = this;
		// util.fill(buffer, function (sample, channel, idx) {
		// 	return Math.sin(Math.PI * 2 * (self.count + idx) * 440 / 44100);
		// });

		return buffer;
	}, {
		//FIXME: there is a trouble when framesize is too small
		samplesPerFrame: 512
	})
	.pipe(Speaker({
		samplesPerFrame: 512
	}));
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
