[![npm install audio-formant](https://nodei.co/npm/audio-formant.png?mini=true)](https://npmjs.org/package/audio-formant/)

```js
var createConverter = require('audio-formant');

var converter = createConverter({
	//can be omitted
	gl: document.createElement('canvas').getContext('webgl'),

	//formants data or number of formants to process (optional)
	formants: 4,

	//output array length (optional)
	blockSize: 512,

	//output number of channels (optional)
	channels: 2,

	//sample rate of output audio chunk (optional)
	sampleRate: 44100,

	//base waveform, 0 - sine (default), 1 - rectangle, 2 - triangle, 3 - saw
	waveform: 0
});


//populate floatArray with audio data in planar format
converter.populate(array?);

//set formants — a sequence of <period, quality, amplitude, panning> tuples
converter.setFormants([0,0,1,1, 1,1,0,0]);

//set formant’s source waveform, by default - <sine, rect, triangle, saw> generated
converter.setSource(data?);

//regenerate noise texture
converter.setNoise(data?);


//re-render to vary formants data per-sample, faster than `setFormants`
converter.textures.formants;

//sound sources of formants
converter.textures.source;


//Converter reserves texture spots form 0 to 5 (in case of sharing gl context).
```


## What is formant?

First off, there is a couple of [definitions of formant in wikipedia](https://en.wikipedia.org/wiki/Formant). Here is opinionated concept of formant.

Formant is a primitive able to describe atomic signal oscillation in terms of _frequency_, _intensity_ and _quality_. The concept is extension of [phasor](https://en.wikipedia.org/wiki/Phasor) with uncertainty parameter.
The idea came from [HSL color model](https://en.wikipedia.org/wiki/HSL_and_HSV) applied to sound, where hue is frequency, saturation is quality and lightness is intensity.
In reality formants can be found in almost any oscillation, starting from vocal tract — produced sound is a sum of membrane’s resonance and exhalation’s noise.
Noise is always a factor existing in any signal, whether in form of dissipation or driving force. That is a fingerprint of reality. And too often it is excluded in analytical systems.
In metaphorical sense, formant expresses harmony/chaos ratio, quality/quantity relation and order of change.

## Why formants?

Formants enable describing and manipulating sound in new ways, engaging the concept of "clarity".
They can find multiple applications in music production, search, sound classification, analysis, recognition, reproducing, restoration, experimenting etc.
One can simply imagine manipulations similar to instagram filters for sound — as if sound is reproduced from vinyl, or singed by someone, or spoken by voice in head, or simple equalizer etc.
Formants enable for a more natural way to understand and speak of sound, from music timbres to animal’s speech.
They act like scalable vector graphics for sound.

## What is the method?

[Experiments](https://github.com/dfcreative/sound-experiment) displayed that the most effective (_O(n)_) way to reproduce formant is sampling a function (basically sine) with randomized step (phase). That method is taken as a basis.

The other methods include:

* applying bandpass filter to white noise
* summing multiple oscillators
* emulating [mass damping system](https://en.wikipedia.org/wiki/Vibration) differential equation with driving noise
* [inverse discrete fourier transform](https://en.wikipedia.org/wiki/Discrete_Fourier_transform)
* wavelets
* autocorrelation functions
* subsampling noise
* analytical solutions
* etc.

## What platform?

> TODO: rework this part

Comparison of available technologies: [Web Audio API](), [streams](), [web workers]() and [WebGL]() has shown that to be able to process...

_Audio-formant_ also introduces _panning_ param, which directs formant wave to one of the output channels.

To aligns formant parameters to 0..1 range, as it is a natural way to store values in textures,


_Frequency_ is similar to the notion of frequency in , but it is expressed in unitless relative manner. _0_ is a constant level, _1_ is a fundamental frequency _f0_, _0.5_ — half of _f0_, 2 — twice of _f0_, etc. By that, frequency can relate one formant to other as overtone or modulation, and can be rendered into any needed pitch. Intuitively frequency displays massiveness, as more massive objects expose lower frequencies, see [simple harmonic motion](https://en.wikipedia.org/wiki/Simple_harmonic_motion).

_Intensity_ displays the intensity of oscillation. It multiplies, or masks, the amplitude. As any oscillation is a transformation between two forms of energy, magnitude reflects the total energy being distributed in oscillator, which can be seen as maximum deviation, or disbalance, in one of these two forms, or the length of phasor vector in general. In sound-producing world, it is often expressed in terms of ADSR, but in general it may take form of any _f(t)_.

_Quality_ is similar to notion of [quality factor](https://en.wikipedia.org/wiki/Q_factor), normalized to range 0..1. By setting the quality to 1 a formant becomes a pure harmonic, by setting it to 0 the formant becomes a pure white noise. Everything in between is a [degree of freedom](https://en.wikipedia.org/wiki/Degrees_of_freedom_(mechanics)) with fuzzy frequency (can be understood as a Helmholtz resonator with unstable volume), which makes it good for description breath-related sounds, like flutes, whistles, natural sound transitions and noise approximation. Also with formant it is natural to express [color of noise](). It is a measure of how much the signal is pure, or focused, in frequency domain.

All that makes formant a versaile tool for describing singnals in practical sense.


## Related

> [audio-pulse](https://npmjs.org/package/audio-pulse) — declarative formants-based model of sound description.<br/>
> [audio-dsp coursera course](https://class.coursera.org/audio-002/wiki/week7) — coursera introductory class to digital signal processing for audio.<br/>
> [periodic-wave](https://webaudio.github.io/web-audio-api/#the-periodicwave-interface) — a way to define phasor in code.<br/>
> [stochastic harmonic oscillation]()