//try to fit multiple gaussians to a signal
'use strict';


const createRenderer = require('../../gl-component');
const τ = Math.PI * 2;


//draw array
let plot = createRenderer({
	context: {antialias: true},
	draw: (gl, vp, data) => {
		if (!data) return;
		let points = [];

		for (let i = 0; i < N; i++) {
			points.push(2 * i/data.samples.length - 1);
			points.push(data.samples[i]);
		}

		plot.setAttribute('position', points);
		plot.setUniform('color', data.color);
		gl.drawArrays(gl.LINE_STRIP, 0, points.length/2);
	},
	frag: `
		precision mediump float;

		uniform vec4 color;

		void main(void) {
			gl_FragColor = color;
		}
	`
});



//generate signal
let N = 256;
let μ = [.65, .35];
let σ = [.15, .1];
let samples = Array(N).fill(0).map((v, i) => {
	let x = i/N;
	return .6*Math.exp( -.5*(x-μ[0])*(x-μ[0])/(σ[0]*σ[0]) )
	+ .3*Math.exp( -.5*(x-μ[1])*(x-μ[1])/(σ[1]*σ[1]) )
	+ Math.random()*0.01;
});

//caculate estimation
let eμ = 0;
let eσ = 0;
let sum = 0;
for (let i = 0; i < N; i++) {
	let x = i/N;
	sum += samples[i];
	eμ += samples[i]*x;
}
eμ /= sum;
for (let i = 0; i < N; i++) {
	let x = i/N;
	eσ += samples[i]*(x - eμ)*(x - eμ);
}
eσ /= sum;
eσ = Math.sqrt(eσ);
let esamples = Array(N).fill(0).map((v, i) => {
	let x = i/N;
	return .6*Math.exp( -.5*(x-eμ)*(x-eμ)/(eσ*eσ) )
});

//draw source data
plot.render({samples, color: [0,0,0,1]});

//draw estimation
plot.render({samples:esamples, color: [1,0,0,1]});
