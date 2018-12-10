'use strict'

const t = require('tape')
const f = require('./')
const out = require('../web-audio-write')()
const fft = require('fourier-transform')
const spectrum = require('../gl-waveform')({ range: [0, 1024] })
const db = require('decibels')
const applyWindow = require('window-function/apply')
const wfn = require('window-function/blackman-harris')
const panzoom = require('pan-zoom')




t('main', t => {
	let end = false
	let buf = new AudioBuffer({sampleRate: 44100, length: 2048, numberOfChannels: 1})

	;(function tick () {
		if (end) return out(null)
		f(buf, {frequency: 1000, quality: 1})

		out(buf, tick)

		// spectrum.push(buf.getChannelData(0))
		show(buf)
	})()
	setTimeout(() => {out(null)}, 2000)


	//buffer source node
	// var context = require('audio-context')()
	// let bufferNode = context.createBufferSource()
	// bufferNode.loop = true;
	// bufferNode.buffer = new AudioBuffer({sampleRate: 44100, length: 2048, numberOfChannels: 1})

	// let node = context.createScriptProcessor(2048)
	// node.addEventListener('audioprocess', function tick (e) {
	// 	f(buf, {frequency: 1000, quality: .5})

	// 	console.time(1)
	// 	for (var channel = 0, l = Math.min(buf.numberOfChannels, e.outputBuffer.numberOfChannels); channel < l; channel++) {
	// 		e.outputBuffer.getChannelData(channel).set(buf.getChannelData(channel));
	// 	}
	// 	console.timeEnd(1)

	// 	show(buf)
	// })

	// bufferNode.connect(node)
	// bufferNode.start()

	// node.connect(context.destination)

	// setTimeout(() => {node.disconnect()}, 2000)

	t.end()
})

t('q: 1 === sine')

t('q: 0 spectrum === noise')

t('a: 1 q: 0, q: 1 max amplitude is ensures')

t('f: 0 - constant value')

t('f: *, q: 0, a: * - same as series')

t('noise colors spectrums')

t('samples are never off the sine')

t('spectrum curve is gaussian')


function show (buf) {
	let data = buf.getChannelData(0)
	data = applyWindow(data.slice(), wfn)
	let mags = fft(data)
	let decibels = mags.map((value) => db.fromGain(value))

	spectrum.update(decibels)
	spectrum.render()
}

interactive(spectrum)
function interactive(wf, o) {
	panzoom(wf.canvas, e => {
		let range = wf.range.slice()

		let w = wf.canvas.offsetWidth
		let h = wf.canvas.offsetHeight

		let rx = e.x / w
		let ry = e.y / h

		let xrange = range[1] - range[0]

		if (e.dz) {
			let dz = e.dz / w
			range[0] -= rx * xrange * dz
			range[1] += (1 - rx) * xrange * dz
		}

		range[0] -= xrange * e.dx / w
		range[1] -= xrange * e.dx / w

		wf.update({ range })
		wf.render()
	})
}
