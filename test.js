'use strict'

const t = require('tape')
const createFormant = require('./')
const write = require('../web-audio-write')()

// TODO: settings-panel
// TODO: gl-waveform
// TODO: bench GPU/WAA

t('main', t => {
	let generateFormant = createFormant([440, 1, 1])

	let end = false;
	;(function tick () {
		if (end) return;
		write(generateFormant(), tick)
	})();

	setTimeout(() => {end = true}, 500)

	t.end()
})

