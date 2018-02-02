'use strict'

const through = require('../audio-through')
const gauss = require('gauss-random')
const pick = require('pick-by-alias')
const periodic = require('periodic-function')

module.exports = createFormant

function createFormant(options) {

	let maxFrequency = 44100,

		// formant components: {f, a, q}, {f, a, q}, ...
		formants = [],

		// phases corresponding to formants (changed every oscillate call)
		phases = []


	// update formant components
	function update(options) {
		if (!options) return;

		if (Array.isArray(options) || ArrayBuffer.isView(options)) options = { components: options }

		// [f,a,q, f,a,q, f,a,q, ...] → [[f, a, q], [f, a, q], ...]
		if ( options.components.length && typeof options.components[0] === 'number' ) {
			let components = []
			for (let i = 0; i < options.components.length; i+=3) {
				components.push(options.components.slice(i, i+3))
			}
			options.components = components
		}

		let { components } = pick(options, {
			components: 'component components formant formants item items harmonic harmonics'
		})

		// for every formant create a filter node connected to white noise node
		formants = components.map((component, i) => {
			if (component.length) component = {
				f: component[0], a: component[1], q: component[2]
			}

			// init phase
			if (!phases[i]) phases[i] = 0

			return pick(component, {
				f: 'f freq frequency hue',
				a: 'a amplitude gain amp lightness',
				q: 'q quality q-factor Q-factor Q qFactor saturation'
			})
		})
	}

	// generate formants array from components
	let oscillate = through((channelsData, state, opts) => {
		// update formants, if passed as options
		if (opts) update(opts)

		// formants generated data
		let data = []
		let sine = periodic.sine;

		// generate formants data
		for (let n = 0; n < formants.length; n++) {
			let {f, q, a} = formants[n]
			let phase = phases[n]
			let formantData = data[n] = Array(channelsData[0].length)

			// populate formant array
			// max step is half
			let average = f / maxFrequency

			// max variance is
			let variance = Math.min(f / q, 1)

			for (let i = 0, l = formantData.length; i < l; i++) {

				phase += sample(average, average/2)
				phase %= 1

				formantData[i] = sine(phase)
			}

			phases[n] = phase
		}

		// merge formants based on amplitudes balance
		for (let c = 0; c < channelsData.length; c++) {
			let channelData = channelsData[c]

			channelData.set(data[0])
		}
	})

	oscillate.update = update
	update(options)


	// sample clamped gauss variable
	function sample (average, variance) {
		let value = -1

		// make sure we pick value more than zero
		while (value < 0) {
			value = average + gauss() * variance
		}

		return value
	}


	return oscillate
}
