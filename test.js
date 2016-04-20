var test = require('tst');
var populate = require('./');
// var Speaker = require('audio-speaker');
// var Through = require('audio-through');


test.only('Just draw one slice', function () {
	var buffer = new Float32Array(512*4);

	buffer = populate(buffer);

	show(buffer.left, 512, 1);
	show(buffer.right, 512, 1);
	show(buffer.phase, 512, 1);
	show(buffer, 512, 1);


	// var buffer = new Float32Array(512*4);
	// buffer = populate(buffer);

	// show(buffer.left, 512, 1);
	// show(buffer.right, 512, 1);
	// show(buffer.phase, 512, 1);
	// show(buffer, 512, 1);


	// var buffer = new Float32Array(512*4);
	// buffer = populate(buffer);

	// // show(buffer.left, 512, 1);
	// // show(buffer.right, 512, 1);
	// show(buffer, 512, 1);


	// var buffer = new Float32Array(512*4);
	// buffer = populate(buffer);

	// // show(buffer.left, 512, 1);
	// // show(buffer.right, 512, 1);
	// show(buffer, 512, 1);
});


test('Basic sound', function () {
	var faq = [0.5, 1, 1, 1];

	Through(function (buffer) {
		populate(buffer);
	}).pipe(Speaker());
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
