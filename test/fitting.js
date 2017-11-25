//try to fit multiple gaussians to a signal
'use strict';


const createRenderer = require('../../gl-component');
const τ = Math.PI * 2;
const almost = require('almost-equal');




fitEM(samples, 3);
// fitKmeans(samples, 3);
// fitSingle(samples);




//try to fit mixture of gaussians by EM algorithm
//NOTE gaussian should not have deviation outside of the range considered, otherwise it will lose amplitude
//NOTE GMDD method is similar to EM, but it does step by step, first covering the prevailing gaussian, then decomposing the remainder as prevailing and remainder, and so on
function fitEM (samples, count) {
	count = count || 1;

	//first we create random set of distributions
	//NOTE: we can do better here by taking peaks as means
	//mean, stdev, amplitude
	let μ = Array(count).fill(0).map(Math.random);
	let υ = Array(count).fill(0).map(Math.random);
	let φ = Array(count).fill(1/count);

	let steps = 100;

	for (let step = 0; step < steps; step++) {
		//E-step: estimate how much every point belongs to every existing distribution
		//probability that x belongs to cluster c
		//in other words, preference of voter over various parties at elections
		let r = Array(count*samples.length);

		for (let i = 0; i < samples.length; i++) {
			let x = i/samples.length;

			//real probability of x in each distrib
			let ρ = Array(count);

			//total probability at the point
			let Σρ = 0;
			for (let c = 0; c < count; c++) {
				//mult by sample is the same as n points at the same place
				ρ[c] = norm(x, φ[c]/Math.sqrt(τ*υ[c]), μ[c], υ[c]);
				Σρ += ρ[c];
			}

			//[rc0, rc1, rc2, rc0, rc1, rc2, ...]
			for (let c = 0; c < count; c++) {
				r[i*count + c] = samples[i] * ρ[c]/Σρ;
			}
		}

		//M-step: update cluster distribution params
		//m - responsibility of a cluster c, sum of every single sample resp r
		//in other words, summary vote the pary got at elections
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

		//get new variations as weighted by ratios stdev
		for (let c = 0; c < count; c++) {
			let Συ = 0;
			for (let i = 0; i < samples.length; i++) {
				let x = i/samples.length;
				Συ += r[i*count + c] * (x - μ[c])*(x - μ[c]);
			}
			υ[c] = Συ/m[c];

			//gotta limit sigma not to be single-point
			υ[c] = Math.max(υ[c], .000000001);
		}






		//rendering normalized by sum of peaks
		let maxAmp = 0;
		let sumData = Array(1024).fill(0).map((v, i, samples) => {
			let x = i/samples.length;
			let sum = 0;
			for (let c = 0; c < count; c++) {
				sum += norm(x, φ[c]/Math.sqrt(τ*υ[c]), μ[c], υ[c]);
			}
			if (sum > maxAmp) maxAmp = sum;
			return sum;
		});

		//draw sum
		let points = [];
		for (let i = 0; i < sumData.length; i++) {
			points.push(2 * i/sumData.length - 1);
			points.push(sumData[i]/maxAmp);
		}
		plot.render({samples: points, color: [.5,.5,.5,step/steps]});


		//draw means drift
		for (let c = 0; c < count; c++) {

			let color = colors[c];
			color[3] = .0 + 1*step/steps;

			//means
			let points = [];
			points.push(μ[c]*2-1, 0);
			points.push(μ[c]*2-1, φ[c]/Math.sqrt(τ*υ[c])/maxAmp);
			plot.render({samples: points, color: color});


			//component
			// drawGaussian(φ[c]/Math.sqrt(τ*σ[c]*σ[c])/maxAmp, μ[c], υ[c], color);
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
	let μ = mean(samples);
	let υ = variance(samples);

	//FIXME: how do we properly detect amplitude here?
	//we should match area of spectrum with the area of gaussian to allow for equal energy distribution
	//is there a fast way to do so? just a sum?
	//FIXME: we should correct lost gaussian energy in case if it is out of spectrum bounds. Or we can limit max allowable variance?

	drawGaussian(max(samples), μ, υ, [1,0,0,1]);

	return [μ, υ];

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
function variance (samples, μ, idx) {
	if (μ == null) μ = mean(samples);
	let sum = 0;
	let υ = 0;
	for (let i = 0; i < samples.length; i++) {
		let x = idx ? idx[i] : i/samples.length;
		sum += samples[i];
		υ += samples[i]*(x - μ)*(x - μ);
	}
	υ /= sum;
	return υ;
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

	let n = 512;
	let samples = Array(n).fill(0).map((v, i) => {
		return norm(i/n, amp, μ, σ)
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
function norm (x, amp, μ, υ) {
	if (υ === 0) return almost(μ, x) ? amp : 0;
	return amp * Math.exp( -.5*(x-μ)*(x-μ)/υ )
}
