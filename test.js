'use strict'

const t = require('tape')
const out = require('web-audio-write')()
const fft = require('fourier-transform')
const spectrum = require('../gl-waveform')()
const db = require('decibels')
const applyWindow = require('window-function/apply')
const wfn = require('window-function/blackman-nuttall')
const panzoom = require('pan-zoom')
const fps = require('fps-indicator')('bottom-left')
let raf = require('raf')
// let {MDCSlider} = require('@material/slider/dist/mdc.slider')
let dom = require('@ungap/create-content').default
let fs = require('fs')
let css = require('insert-css')
// css(fs.readFileSync(require.resolve('@material/slider/dist/mdc.slider.min.css'), 'utf-8'))
css( fs.readFileSync(require.resolve('preact-material-components/style.css'), 'utf-8'));

import {h, render} from 'preact';
import {Slider, FormField, Typography} from 'preact-material-components';

// create settings
// let {render} = require('react-dom')
// let h = require('htm').default.bind(require('react').createElement)

// let Typography = require('@material-ui/core/Typography').default
// let Slider = require('@material-ui/lab/Slider').default


// document.body.appendChild(document.createElement('div')).id = 'abc'

// var value = 3

// function doreact() {
// render(h`
// 	<div style="${{width: 300}}">
// 	<${Typography} id="label">Slider label<//>

// 	<${Slider}
// 	      min=${0}
// 	      max=${6}
// 	      step=${1}
// 		  value=${value}
// 		  onChange=${(e, v) => {
// 		  	value = v
// 		  	doreact()
// 		  }}
// 		aria-labelledby="label" />
// 	</div>
// `, document.querySelector('#abc'))
// }
// doreact()


t.only('waa node', t => {
	let context = require('audio-context')()
	let formant = require('./index')(context)

	var analyser = context.createAnalyser();
	analyser.fftSize = 8192;

	formant.connect(analyser)

	spectrum.amplitude = [0, 400]

	raf(function draw () {
		let arr = new Uint8Array(analyser.frequencyBinCount)
		analyser.getByteFrequencyData(arr)
		// let arr = new Float32Array(analyser.frequencyBinCount)
		// analyser.getFloatFrequencyData(arr)
		if (arr[0] !== -Infinity) {
			spectrum.update(arr)
			spectrum.render()
		}

		raf(draw)
	})

	analyser.connect(context.destination)

	document.body.style.overflow = 'hidden'

	/* @jsx h */
	render(
		<div>
			<Typography title>Q factor</Typography>
			<Slider id="q"
				onInput={e => {
					let df = formant.frequency.value * (100 - e.detail.value) / 100
					formant.Q.value = !df ? 99999 : formant.frequency.value / df
				}}
				step={1}
				min={0}
				value={0}
				max={100}/>
			<Typography title>Frequency</Typography>
			<Slider id="f"
				onInput={e => {
					formant.frequency.value = e.detail.value
				}}
				step={1}
				min={0}
				value={440}
				max={22050}/>
		</div>
	, document.body)

	t.end()
})


t.skip('walker', t => {
	const f = require('./experiment/walker')

	let end = false
	let buf = new AudioBuffer({sampleRate: 44100, length: 2048, numberOfChannels: 1})


	// writer
	// spectrum.range = -2048

	// ;(function tick () {
	// 	if (end) return out(null)

	// 	f(buf, {frequency: 440, quality: 1})

	// 	out(buf, tick)

	// 	// spectrum.push(buf.getChannelData(0)).clear().render()
	// 	show(buf)
	// })()
	// setTimeout(() => {out(null)}, 2000)


	//buffer source node
	var context = require('audio-context')()
	let bufferNode = context.createBufferSource()
	bufferNode.loop = true;
	bufferNode.buffer = new AudioBuffer({sampleRate: 44100, length: 2048, numberOfChannels: 1})

	let freq = 4000

	let node = context.createScriptProcessor(2048)
	node.addEventListener('audioprocess', function tick (e) {
		f(buf, {frequency: freq, quality: .5})

		for (var channel = 0, l = Math.min(buf.numberOfChannels, e.outputBuffer.numberOfChannels); channel < l; channel++) {
			e.outputBuffer.getChannelData(channel).set(buf.getChannelData(channel));
		}

		// show(buf)
	})

	bufferNode.connect(node)
	bufferNode.start()


	var analyser = context.createAnalyser();
	analyser.fftSize = 2048;

	// add biquad filter after script processor
	let filterNode = context.createBiquadFilter()
	filterNode.type = 'bandpass'
	filterNode.frequency.value = freq
	filterNode.Q.value = 1000
	let filterNode2 = context.createBiquadFilter()
	filterNode2.type = 'bandpass'
	filterNode2.frequency.value = freq
	filterNode2.Q.value = 1000
	let filterNode3 = context.createBiquadFilter()
	filterNode3.type = 'bandpass'
	filterNode3.frequency.value = freq
	filterNode3.Q.value = 1000

	node.connect(filterNode)
	filterNode.connect(filterNode2)
	filterNode2.connect(filterNode3)
	filterNode3.connect(analyser)

	raf(function draw () {
		let arr = new Uint8Array(analyser.frequencyBinCount)
		analyser.getByteFrequencyData(arr)
		// let arr = new Float32Array(analyser.frequencyBinCount)
		// analyser.getFloatFrequencyData(arr)
		if (arr[0] !== -Infinity) {
			spectrum.update(arr)
			spectrum.render()
		}

		raf(draw)
	})

	analyser.connect(context.destination)

	setTimeout(() => {node.disconnect()}, 2000)

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

t('pure formants generate the same as pure spectrum')


function show (buf) {
	let data = buf.getChannelData(0)
	// data = applyWindow(data.slice(), wfn)
	let mags = fft(data)
	let decibels = mags.map((value) => db.fromGain(value))

	// spectrum.update(decibels)
	spectrum.update(mags)
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
