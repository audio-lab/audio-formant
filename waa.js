/**
 * Web-audio-API based formant generator
 */

'use strict'

let createContext = require('audio-context')
let pick = require('pick-by-alias')

module.exports = createFormantNode

function createFormantNode (options) {
	let context

	// TODO: engage context, channels here
	if (options && options.context) context = options.context
	else context = createContext()

	// create white noise node
	let noiseData = new Float32Array(44100 * 5)
	let noiseBuffer = null

	for (let i = 0, imax = noiseData.length; i < imax; i++) {
		noiseData[i] = Math.random() * 2 - 1
	}

	noiseBuffer = context.createBuffer(1, noiseData.length, context.sampleRate)
	noiseBuffer.getChannelData(0).set(noiseData)
	let noiseNode = context.createBufferSource()

	noiseNode.buffer = noiseBuffer
	noiseNode.loop = true

	// create formant nodes
	update(options)

	return noiseNode


	function update(options) {
		if (Array.isArray(options)) options = { components: options }

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
		let formantNodes = components.map(component => {
			if (component.length) component = {
				f: component[0], a: component[1], q: component[2]
			}

			let {frequency, amplitude, quality} = pick(component, {
				frequency: 'f freq frequency hue',
				amplitude: 'a amplitude gain amp lightness',
				quality: 'q quality q-factor Q-factor Q qFactor saturation'
			})

			let filterNode = context.createBiquadFilter()
			filterNode.type = 'bandpass'
			console.log(frequency, amplitude, quality)
			filterNode.frequency.value = frequency
			filterNode.gain.value = 1
			filterNode.Q.value = 99

			let oscNode = context.createOscillator()
			oscNode.type = 'sine'
			oscNode.frequency.value = frequency

			let gainNode = context.createGain()
			oscNode.start()


			noiseNode.connect(filterNode)
			oscNode.connect(gainNode)
			gainNode.connect(context.destination)
			filterNode.connect(context.destination)

			return filterNode
		})
	}
}
