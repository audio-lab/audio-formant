# audio-formant [![experimental](https://img.shields.io/badge/stability-unstable-green.svg)](http://github.com/badges/stability-badges)

Color model applied to sound.

[![npm install audio-formant](https://nodei.co/npm/audio-formant.png?mini=true)](https://npmjs.org/package/audio-formant/)

```js
let formant = require('audio-formant')
let output = require('audio-speaker')()
let AudioBuffer = require('audio-buffer')

let buf = new AudioBuffer
(function tick(error) {
  // approximate grey noise
  formant(audioBuffer, {f: 440, quality: .2})
  output(audioBuffer, tick)
})()
```

## `let result = formant(length|dst, options)`

Populate target audio-buffer/array of the `length` with formant wave samples. `options` can update formant params.

#### `options`

| Property | Default | Meaning |
|---|---|---|
| `sampleRate`, `rate` | `44100` | Output data sample rate. |
| `channels`, `numberOfChannels` | `1` | Output data number of channels. |
| `format`, `dtype` | `'float32'` | Output data format, eg. `'uint8 interleaved'`, `'float32 planar'`, `'array'`, `'audiobuffer'` etc. See [pcm-convert](https://github.com/audiojs/pcm-convert) and [audio-format](https://github.com/audiojs/audio-format) for list of available formats. |
| `length`, `frameSize`, `samplesPerFrame` | `1024` | Default length of an output block.

#### `options.formant`

Every formant contains

## `generate(target|length, options?)`



# History

## What is formant?

First off, there is a couple of [definitions of formant in wikipedia](https://en.wikipedia.org/wiki/Formant). Here we understand formant as an oscillation with uncertain frequency. Imagine a bandpass filter applied to white noise - that is a single formant.

Formant has _frequency_, _amplitude_ and _quality_ components, similar to [HSL color model](https://en.wikipedia.org/wiki/HSL_and_HSV). `quality` adds a dimension varying sound from pure oscillation to white noise.

In reality, formants can be seen in any sound, from vocal tract - a sum of membrane’s resonance and exhalation’s noise, to car engines. They are more natural way we percieve and describe sound, try to whistle - that is a single formant.

Noise is always a factor existing in any signal, whether in form of dissipation or driving force. That is a fingerprint of reality. And too often it is excluded in analytical systems as "bad" factor. With formants, noise is considered a part of the picture.


## Why formants?

Formants open new ways to describe/manipulate sound, enabling concept of "clarity". They can find applications in music production, search, classification, analysis, recognition, reproducing, restoration, experimenting etc.

One can simply imagine manipulations similar to instagram filters for sound — as if sound is reproduced from vinyl, or singed by someone, or spoken by voice in head, or simple equalizer etc.

Formants enable more natural way of understanding sound, from music timbres to animal voices. They act like scalable vector graphics for sound.

## What is the algorithm?

[Experiments](https://github.com/dy/sound-experiment) show that the most effective known way to reproduce formant is sampling a function (basically sine) with randomized step (phase), renders _O(n)_ computational complexity. The method is called "phase walking".

The idea is somewhat between granular synthesis and quantum path.

Other methods include:

* applying bandpass filter to white noise
* summing multiple oscillators
* emulating [mass damping system](https://en.wikipedia.org/wiki/Vibration) differential equation with driving noise
* [inverse discrete fourier transform](https://en.wikipedia.org/wiki/Discrete_Fourier_transform)
* wavelets
* autocorrelation functions
* subsampling noise
* analytical solution

## Benchmark?

Comparison of available technologies:

* [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
* [streams](https://nodejs.org/api/stream.html)
* [threads](https://www.npmjs.com/package/webworker-threads)
* [web workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)
* [WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API) has shown that for realtime processing of hundreds of formants WebGL is the only viable technology, because it allows for extensive native parallelism unavailable anywhere else.

Nonetheless it has own difficulties, as it was not designed for sound processing. In particular, fragments has no correlation, therefore there is no simple way to walk the "phase path". There are two options for that: walking the path in each fragment or walking in verteces with saving values to varyings. The second method is significantly faster for big numbers of formants, but the [number of varyings](http://webglstats.com/) is limited depending on browser.

## Implementation

Formant parameters are brought to `0..1` range, because that range is easy to understand, calculate, store, convert, display and also is widely used in every related domain.

_Period_ reflects frequency of formant. Values from `0..1` range cover frequency values from 1hz to 20+khz. Intuitively period displays massiveness, as more massive objects exhibit lower frequencies, see [simple harmonic motion](https://en.wikipedia.org/wiki/Simple_harmonic_motion).

_Intensity_ displays the magnitude of oscillation. It masks the amplitude of produced wave. As any oscillation is a transformation between two forms of energy, magnitude reflects total energy being distributed in oscillator, which can be seen as maximum deviation, or disbalance, in one of these two forms, or the length of phasor vector in general.

_Quality_ is [Q factor](https://en.wikipedia.org/wiki/Q_factor) normalized to range 0..1 by `quality = f / tan(2 * π * Q)`. Value `1` makes formant a pure harmonic, `0` — white noise. Everything in between is a [degree of freedom](https://en.wikipedia.org/wiki/Degrees_of_freedom_(mechanics)) with fuzzy frequency. It can be understood as a Helmholtz resonator with unstable volume. That parameter makes formant good for describing breath-related sounds, like flutes, whistles, natural sound transitions and noise approximation. Also with formant it is natural to express [color of noise](https://en.wikipedia.org/wiki/Colors_of_noise). It is a measure of how much the signal is pure, or focused, in frequency domain.

_Panning_ param directs output to one of the output channels. It allows for easily implementing any number of audio channels. Also it is natural concept known to every sound producer.

## Sources

* [audio-dsp coursera course](https://class.coursera.org/audio-002/wiki/week7) — coursera introductory class to digital signal processing for audio.
* [periodic-wave](https://webaudio.github.io/web-audio-api/#the-periodicwave-interface) — a way to define phasor in code.
* [EM algorithm](https://www.researchgate.net/publication/220848309_Blind_Separation_of_Sparse_Sources_Using_Jeffrey's_Inverse_Prior_and_the_EM_Algorithm)
* [gaussian mixture](https://github.com/benjamintd/gaussian-mixture)

## License

(c) 2017 Dima Yv. MIT License
