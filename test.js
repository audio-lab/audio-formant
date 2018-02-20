'use strict'

const t = require('tape')
const createFormant = require('./')
const write = require('../web-audio-write')()
const createSettings = require('../settings-panel')

// TODO: settings-panel
// TODO: gl-waveform
// TODO: bench GPU/WAA

t('main', t => {
	let formant = createSettings({
		frequency: 880,
		quality: 1,
		amplitude: 1
	}, {
		fields: { frequency: {min: 0, max: 10000} },
		change: formant => {
			generateFormant.update([formant])
		}
	})

	let generateFormant = createFormant([formant])

	let end = false;
	;(function tick () {
		if (end) return;
		write(generateFormant(), tick)
	})();

	setTimeout(() => {end = true}, 500)

	t.end()
})

