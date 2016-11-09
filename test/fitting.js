//try to fit multiple gaussians to a signal
'use strict';


const createRenderer = require('../../gl-component');
const τ = Math.PI * 2;
const almost = require('almost-equal');


//draw array
let plot = createRenderer({
	context: {antialias: true},
	autostart: false,
	draw: (gl, vp, data) => {
		if (!data) return;
		let points = data.samples;

		plot.setAttribute('position', points);
		plot.setUniform('color', data.color);
		gl.drawArrays(gl.LINE_STRIP, 0, points.length/2);
	},
	vert: `
		attribute vec2 position;
		void main () {
			gl_PointSize = 2.;
			gl_Position = vec4(position, 0, 1);
		}
	`,
	frag: `
		precision mediump float;

		uniform vec4 color;

		void main(void) {
			gl_FragColor = color;
		}
	`
});


//colors for multicurves
let colors = [[1,0,0,1], [0,.5,0,1], [0,0,.5,1]];


//generate spectrum
//note that each sample denotes the density at a point (number of samples at a point in other words), not the classical data for k-means
//in that, k-means does not create classes of output data
let N = 256;
let μ = [.65, .45];
let σ = [.1, .05];
let samples = Array(N).fill(0).map((v, i, samples) => {
	let x = i/samples.length;
	return norm(x,.12/Math.sqrt(τ*σ[0]*σ[0]), μ[0], σ[0])
	+ norm(x,.08/Math.sqrt(τ*σ[1]*σ[1]), μ[1], σ[1])
	+ Math.random()*0.02;
});
//normalize samples
let sum = samples.reduce((curr, prev) => curr+prev);
let maxV = samples.reduce((curr, prev) => Math.max(curr, prev));
samples = samples.map(v => v/maxV);


//draw source data
let points = [];
for (let i = 0; i < samples.length; i++) {
	points.push(2 * i/samples.length - 1);
	points.push(samples[i]);
}
plot.render({samples: points, color: [0,0,0,1]});


fitEM(samples, 2);
// fitKmeans(samples, 3);
// fitSingle(samples);



//try to fit mixture of gaussians by EM algorithm
function fitEM (samples, count) {
	count = count || 1;

	//first we create random set of distributions
	//NOTE: we can do better here by taking peaks as means
	//mean, stdev, amplitude
	let μ = Array(count).fill(0).map(Math.random);
	let σ = Array(count).fill(0).map(Math.random);
	let φ = Array(count).fill(1/count);

	let steps = 60;

	for (let step = 0; step < steps; step++) {
		//E-step: estimate how much every point belongs to every existing distribution
		let r = Array(count*samples.length);

		for (let i = 0; i < samples.length; i++) {
			let x = i/samples.length;

			//real probability of x in each distrib
			let ρ = Array(count);

			//total probability at the point
			let Σρ = 0;
			for (let c = 0; c < count; c++) {
				//mult by sample is the same as n points at the same place
				ρ[c] = norm(x, φ[c]/Math.sqrt(τ*σ[c]*σ[c]), μ[c], σ[c]);
				Σρ += ρ[c];
			}

			//probability that x belongs to cluster c = v/sum
			//[rc0, rc1, rc2, rc0, rc1, rc2, ...]
			for (let c = 0; c < count; c++) {
				r[i*count + c] = samples[i] * ρ[c]/Σρ;
			}
		}

		//M-step: update cluster distribution params
		//m - responsibility of a cluster c, sum of every single sample resp r
		//in other words, area taken by the cluster
		let m = Array(count).fill(0);
		let Σm = 0;
		for (let c = 0; c < count; c++) {
			for (let i = 0; i < samples.length; i++) {
				m[c] += r[i*count + c];
			}
			Σm += m[c];
		}

		//get new amp as ratio of the total weight
		for (let c = 0; c < count; c++) {
			φ[c] = m[c] / Σm;
		}

		//get new mean as weighted by ratios value
		for (let c = 0; c < count; c++) {
			let Σμ = 0;
			for (let i = 0; i < samples.length; i++) {
				let x = i/samples.length;
				Σμ += x * r[i*count + c];
			}
			μ[c] = Σμ/m[c];
		}

		//get new stdevs as weighted by ratios stdev
		for (let c = 0; c < count; c++) {
			let Σσ = 0;
			for (let i = 0; i < samples.length; i++) {
				let x = i/samples.length;
				Σσ += r[i*count + c] * (x - μ[c])*(x - μ[c]);
			}
			σ[c] = Σσ/m[c];
			σ[c] = Math.sqrt(σ[c]);

			//gotta limit sigma not to be single-point
			σ[c] = Math.max(σ[c], .000001);
		}



		//rendering
		let maxVs = φ.map((v, c) => v/Math.sqrt(τ*σ[c]*σ[c]));
		let maxV = maxVs.reduce((curr, prev) => Math.max(curr, prev));


		//draw means drift
		for (let c = 0; c < count; c++) {

			let color = colors[c];
			color[3] = .0 + 1*step/steps;

			//means
			let points = [];
			points.push(μ[c]*2-1, 0);
			points.push(μ[c]*2-1, φ[c]/Math.sqrt(τ*σ[c]*σ[c])/maxV);
			plot.render({samples: points, color: color});


			//component
			drawGaussian(φ[c]/Math.sqrt(τ*σ[c]*σ[c])/maxV, μ[c], σ[c], color);
		}
	}

}



//try to fit number of gaussians to the samples set by k-means method
function fitKmeans(samples, count) {
	count = count || 1;

	let eps = 0.0001;
	let prevμ = Array(count).fill(0).map(Math.random);

	//first pick initial means
	let μ = prevμ.slice();
	let groups; //initial samples distributed by cluster groups
	let idx; //samples indices distributed by cluster groups

	let c = 0;
	while (c++ < 10) {
		groups = Array(count).fill(null).map(v => []);
		idx = groups.slice().map(v => []);
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
			idx[group].push(i/samples.length);
		}

		//then for each group estimate mean
		for (let group = 0; group < count; group++) {
			μ[group] = mean(groups[group], idx[group]);
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
	let σ = Array(count).fill(0).map((v, i) => sd(groups[i], μ[i], idx[i]));

	//calc variance for groups
	for (let group = 0; group < count; group++){
		let samples = groups[group];
		drawGaussian(maxes[group], μ[group], σ[group], colors[group]);
	}

	//draw sum of gaussians
	let sumData = samples.map((v, i, samples) => {
		let x = i/samples.length;
		let sum = 0;
		for (let group = 0; group < count; group++) {
			sum += norm(x, maxes[group], μ[group], σ[group]);
		}
		return sum;
	});

	//draw sum
	let points = [];
	for (let i = 0; i < sumData.length; i++) {
		points.push(2 * i/sumData.length - 1);
		points.push(sumData[i]);
	}
	plot.render({samples: points, color: [.5,.5,.5,1]});


	//draw groups
	for (let group = 0; group < count; group++) {
		let values = groups[group];
		let points = [];
		let indexes = idx[group];

		for (let i = 0; i < values.length; i++) {
			points.push(2 * indexes[i] - 1);
			points.push(values[i]);
		}

		//draw source data
		plot.render({samples: points, color: colors[group]});
	}
}


//fit single gaussian to the data
function fitSingle (samples) {
	drawGaussian(max(samples), mean(samples), sd(samples), [1,0,0,1]);
}


//get x mean
function mean (samples, idx) {
	let sum = 0;
	let μ = 0;
	for (let i = 0; i < samples.length; i++) {
		let x = idx ? idx[i] : i/samples.length;
		sum += samples[i];
		μ += samples[i]*x;
	}
	μ /= sum;
	return μ;
}
function sd (samples, μ, idx) {
	if (μ == null) μ = mean(samples);
	let sum = 0;
	let σ = 0;
	for (let i = 0; i < samples.length; i++) {
		let x = idx ? idx[i] : i/samples.length;
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

	let points = [];
	for (let i = 0; i < samples.length; i++) {
		points.push(2 * i/samples.length - 1);
		points.push(samples[i]);
	}

	//draw estimation
	plot.render({samples: points, color: color});
}


//return normal dist
function norm (x, amp, μ, σ) {
	if (σ === 0) return almost(μ, x) ? amp : 0;
	return amp * Math.exp( -.5*(x-μ)*(x-μ)/(σ*σ) )
}
