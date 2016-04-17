var test = require('tst');
var populate = require('./');
// var Speaker = require('audio-speaker');
// var Through = require('audio-through');


test.only('Just draw one slice', function () {
	var buffer = new Float32Array(512*4);

	buffer = buffer.map(function (v, i) {
		if ((i+1) % 4 === 0) return 1;
		if (i % 4 === 0) return 1;
		return 0;
	});

	buffer = populate(buffer, [0.5, 1, 1, 1]);

	show(buffer.left, 512, 1);
	show(buffer.right, 512, 1);
	show(buffer, 512, 1);
});


test('Basic sound', function () {
	var faq = [0.5, 1, 1, 1];

	Through(function (buffer) {
		populate(buffer, faq);
	}).pipe(Speaker());
});



function show (pixels, w, h) {
	// var pixels = new Float32Array(w * h * 4);
	// gl.readPixels(0, 0, w, h, gl.RGBA, gl.FLOAT, pixels);

	var canvas = document.createElement('canvas');
	canvas.width = w*4;
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