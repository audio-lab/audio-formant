//try to fit multiple gaussians to a signal
'use strict';


const createRenderer = require('../../gl-component');
const τ = Math.PI * 2;
const almost = require('almost-equal');


//draw array
let plot = createRenderer({
	context: {antialias: true},
	draw: (gl, vp, data) => {
		if (!data) return;
		let points = [];
		let samples = data.samples;

		for (let i = 0; i < samples.length; i++) {
			points.push(2 * i/samples.length - 1);
			points.push(samples[i]);
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



//generate spectrum
//note that each sample denotes the density at a point (number of samples at a point in other words), not the classical data for k-means
//in that, k-means does not create classes of output data
let N = 256;
let μ = [.65, .35];
let σ = [.15, .1];
let samples = Array(N).fill(0).map((v, i, samples) => {
	let x = i/samples.length;
	return .6*Math.exp( -.5*(x-μ[0])*(x-μ[0])/(σ[0]*σ[0]) )
	+ .3*Math.exp( -.5*(x-μ[1])*(x-μ[1])/(σ[1]*σ[1]) )
	+ Math.random()*0.05;
});

//draw source data
plot.render({samples, color: [0,0,0,1]});


// fitKmeans(samples, 2);
fitSingle(samples);



//try to fit number of gaussians to the samples set by k-means method
function fitKmeans(samples, count) {
	count = count || 1;

	let eps = 0.001;
	let prevμ = Array(count).fill(0).map(Math.random);

	//first pick initial means
	let μ = prevμ;
	let groups;

	let c = 0;
	while (c++ < 10) {
		groups = Array(count).fill(null).map(v => []);
		//then calculate distances to means and assign each point a class
		for (let i = 0; i < samples.length; i++) {
			let x = i / samples.length;
			let sample = samples[i];
			let minDist = Infinity;
			let group = 0;
			for (let j = 0; j < count; j++) {
				let dist = Math.abs(μ[j] - x);
				if (dist < minDist) {
					minDist = dist;
					group = j;
				}
			}
			groups[group].push(sample);
		}

		//then for each group estimate mean
		for (let group = 0; group < count; group++) {
			μ[group] = mean(groups[group]);
		}

		//if μ did not change from last time, estimate variance and end
		if (prevμ.every((v, i) => almost(v, μ[i], eps))) {
			break;
		}

		//save means
		prevμ = μ;
	}

	console.log(`ended after ${c} iterations`, μ);

	let maxes = Array(count).fill(0).map((v, i) => max(groups[i]));
	let σ = Array(count).fill(0).map((v, i) => sd(groups[i], μ[i]));

	//calc variance for groups
	for (let group = 0; group < count; group++){
		let samples = groups[group];
		drawGaussian(maxes[group], μ[group], σ[group], [0.5,.5,.5,1]);
	}

	//draw sum of gaussians
	let sumData = samples.map((v, i) => {
		let x = i/N;
		let sum = 0;
		for (let group = 0; group < count; group++) {
			sum += norm(x, maxes[group], μ[group], σ[group]);
		}
		return sum;
	});

	//draw estimation
	plot.render({samples: sumData, color: [1,0,0,1]});
}


//fit single gaussian to the data
function fitSingle (samples) {
	drawGaussian(max(samples), mean(samples), sd(samples), [1,0,0,1]);
}


//get x mean
function mean (samples) {
	let sum = 0;
	let μ = 0;
	for (let i = 0; i < samples.length; i++) {
		let x = i/samples.length;
		sum += samples[i];
		μ += samples[i]*x;
	}
	μ /= sum;
	return μ;
}
function sd (samples, μ) {
	if (μ == null) μ = mean(samples);
	let sum = 0;
	let σ = 0;
	for (let i = 0; i < samples.length; i++) {
		let x = i/samples.length;
		sum += samples[i];
		σ += samples[i]*(x - μ)*(x - μ);
	}
	σ /= sum;
	σ = Math.sqrt(σ);
	return σ;
}
function max (samples) {
	let max = 0;
	for (let i = 0; i<samples.length; i++) {
		if (samples[i] > max) max = samples[i];
	}
	return max;
}



function drawGaussian (amp, μ, σ, color) {
	color = color || [0,0,0,1]

	let samples = Array(N).fill(0).map((v, i) => {
		return norm(i/N, amp, μ, σ)
	});

	//draw estimation
	plot.render({samples, color: color});
}


//return normal dist
function norm (x, amp, μ, σ) {
	return amp * Math.exp( -.5*(x-μ)*(x-μ)/(σ*σ) )
}
