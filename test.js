'use strict'

const t = require('tape')
const f = require('./')
const out = require('web-audio-write')()

t('main', t => {
	let end = false
	let buf = new AudioBuffer({sampleRate: 44100, length: 1024, numberOfChannels: 1})

	;(function tick () {
		if (end) return
		out(f(buf, {frequency: 4400, quality: 1}), tick)
	})()

	setTimeout(() => {end = true}, 500)

	t.end()
})

