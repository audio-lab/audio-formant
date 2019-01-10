// "classic" walker formant

'use strict'

const gauss = require('gauss-random')
const sine = require('periodic-function/sine')

module.exports = oscillate


function oscillate(dst, o) {
	// handle destination
	if (!dst) throw Error('First argument should be a number, an array or a list of arrays')
	if (typeof dst === 'number') dst = new Array(dst)

	// list of arrays
	if (dst[0] && dst[0].length != null) return dst.map(function (dst, channel) {
		return oscillate(dst, o)
	})

	// handle options
	if (typeof o === 'number') o = {frequency: o}
	else if (!o) o = {}

	// audiobuffer
	if (dst.getChannelData) {
		if (!o.sampleRate) o.sampelRate = dst.sampleRate
		for (var i = 0; i < dst.numberOfChannels; i++) {
			oscillate(dst.getChannelData(i), o)
		}
		return dst
	}

	// aliases
	o.frequency = o.f != null ? o.f : o.freq != null ? o.freq : o.frequency
	o.phase = o.t != null ? o.t : o.phase
	o.quality = o.q != null ? o.q : o.quality

	var t = o.phase != null ? (o.phase || 0) : dst.phase || 0
	var frequency = o.frequency != null ? (o.frequency || 0) : (dst.frequency || 440)
	var detune = o.detune != null ? o.detune : dst.detune || 0
	var quality = o.quality != null ? o.quality : dst.quality || 0
	var rate = o.sampleRate || o.rate || dst.sampleRate || 44100

	let sdev = 4

	for (let i = 0, l = dst.length; i < l; i++) {
		let step = ((frequency + gauss() * sdev) * Math.pow(2, detune / 1200)) / rate
		t +=  step
		t %= 1

		dst[i] = sine(t)
	}

	// save data params to result
	dst.frequency = frequency
	dst.phase = t
	dst.detune = detune
	dst.sampleRate = rate

	return dst
}
