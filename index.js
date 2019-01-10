/**
 * Web-audio-API based formant generator
 */

'use strict'

let createContext = require('audio-context')
let pick = require('pick-by-alias')
let sin = require('audio-oscillator/sin')


module.exports = createFormantNode


function createFormantNode (options) {
	let context

	if (options.sampleRate) context = options
	else if (options && options.context) context = options.context
	else context = createContext()

	let frequency = 440, amplitude = 1, quality = 1

	// create white noise node
	let noiseBuffer = context.createBuffer(1, context.sampleRate, context.sampleRate)
	let noiseData = noiseBuffer.getChannelData(0)

	// set up updating noise routine
	;(function genNoise() {
		// add sin & noise
		// sin(noiseData, frequency)
		for (let i = 0, l = noiseData.length; i < l; i++) {
			noiseData[i] = Math.random() * 2 - 1
		}
		setTimeout(genNoise, 1000)
	})()

	let noiseNode = context.createBufferSource()

	noiseNode.buffer = noiseBuffer
	noiseNode.loop = true
	noiseNode.start()

	let o = pick(options || {}, {
		frequency: 'f freq frequency hue',
		amplitude: 'a amplitude gain amp lightness',
		quality: 'q quality q-factor Q-factor Q qFactor saturation'
	})
	if (o.frequency != null) frequency = o.frequency
	if (o.amplitude != null) amplitude = o.amplitude
	if (o.quality != null) quality = o.quality

	let filterNode = context.createBiquadFilter()
	filterNode.type = 'bandpass'

	filterNode.frequency.value = frequency
	filterNode.gain.value = 1
	filterNode.Q.value = quality

	let oscNode = context.createOscillator()
	oscNode.type = 'sine'
	oscNode.frequency.value = frequency

	let gainNode = context.createGain()
	gainNode.gain.value = 1;
	oscNode.start()

	oscNode.connect(gainNode)
	// gainNode.connect(context.destination)
	noiseNode.connect(filterNode)
	// filterNode.connect(context.destination)

	return filterNode
}
