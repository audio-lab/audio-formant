//try to fit multiple gaussians to a signal
'use strict';


const createRenderer = require('../../gl-component');
const τ = Math.PI * 2;


//generate signal
let N = 256;
let μ = .5;
let σ = .1;
let samples = Array(N).fill(0).map((v, i) => {
	let x = i/N;
	return .1*Math.exp( -.5*(x-μ)*(x-μ)/(σ*σ) ) / Math.sqrt(σ*σ*τ) + Math.random()*0.1;
});


//draw array
let plot = createRenderer({
	context: {antialias: true},
	draw: (gl, vp, samples) => {
		if (!samples) return;
		let data = [];

		for (let i = 0; i < N; i++) {
			data.push(2 * i/samples.length - 1);
			data.push(samples[i]);
			data.push(2 * (i+1)/samples.length - 1);
			data.push(samples[i+1]);
		}

		plot.setAttribute('position', data);
		gl.drawArrays(gl.LINES, 0, data.length/2);
	},
	frag: `
		precision mediump float;

		void main(void) {
			gl_FragColor = vec4(0,0,0,1);
		}
	`
});

plot.render(samples);
