> Convert formants to audio.

[![npm install audio-formant](https://nodei.co/npm/audio-formant.png?mini=true)](https://npmjs.org/package/audio-formant/)

```js
var createConverter = require('audio-formant');

//Create formants converter instance based on settings (optional).
var converter = createConverter({
	//gl context, created in case if omitted
	gl: document.createElement('canvas').getContext('webgl'),

	//number of formants to process (optional)
	formants: 2,

	//output array length (optional)
	blockSize: 512,

	//output number of channels (optional)
	channels: 2,

	//sample rate of output audio chunk (optional)
	sampleRate: 44100
});


//Set formants data: a collection of <frequency, amplitude, panning, quality> tuples.
//For better performance and accuracy — render `textures.formants`.
converter.setFormants([0,0,1,1, 1,1,0,0]);

//Populate floats array with audio data in planar format.
//If array is omitted - a new one will be created.
converter.populate(array?);

//Init source texture values. If data is omitted then sine will be generated.
converter.initSource(data?);

//Regenerate noise texture (if you feel bad about current one).
converter.updateNoise();


//Formants data, can be re-rendered to vary formants data per-sample.
//Faster than `setFormants`.
converter.textures.formants;

//Source primitives for according formant rows.
//Can be replaced to triangle, saw, etc. or modified for specific formant rows.
converter.textures.source;


//Converter reserves texture spots form 0 to 5 (in case of sharing gl context).
```


## What is formant?

First off, there is a couple of [definitions of formant in wikipedia](https://en.wikipedia.org/wiki/Formant) for background. Here is an opinionated concept of formant is used.

Formant is a sound primitive, able to describe/produce atomic signal oscillation in terms of _frequency_, _amplitude_ and _quality_. The idea is inspired by [HSL color model](https://en.wikipedia.org/wiki/HSL_and_HSV) applied to sound, where hue is frequency, saturation is quality and lightness is amplitude. The idea is reminiscent of [stochastic harmonic oscillator](), where noise is used as a driving signal. Practically it can be seend as a bandpass filter applied to the white noise. In reality it can be found in almost any harmonic oscillator, starting from vocal tract - the noise is used as a driving signal, therefore there is uncertainty, or quality of produced sound.

_Frequency_ is similar to the notion of frequency in [phasor](https://en.wikipedia.org/wiki/Phasor), but it is expressed in unitless relative manner. _0_ is a constant level, _1_ is a fundamental frequency _f0_, _0.5_ — half of _f0_, 2 — twice of _f0_, etc. By that, frequency can relate one formant to other as overtone or modulation, and can be rendered into any needed pitch. Intuitively frequency displays massiveness, as more massive objects expose lower frequencies, see [simple harmonic motion](https://en.wikipedia.org/wiki/Simple_harmonic_motion).

_Intensity_ displays the intensity of oscillation. It multiplies, or masks, the amplitude. As any oscillation is a transformation between two forms of energy, magnitude reflects the total energy being distributed in oscillator, which can be seen as maximum deviation, or disbalance, in one of these two forms, or the length of phasor vector in general. In sound-producing world, it is often expressed in terms of ADSR, but in general it may take form of any _f(t)_.

_Quality_ is similar to notion of [quality factor](https://en.wikipedia.org/wiki/Q_factor), normalized to range 0..1. By setting the quality to 1 a formant becomes a pure harmonic, by setting it to 0 the formant becomes a pure white noise. Everything in between is a [degree of freedom](https://en.wikipedia.org/wiki/Degrees_of_freedom_(mechanics)) with fuzzy frequency (can be understood as a Helmholtz resonator with unstable volume), which makes it good for description breath-related sounds, like flutes, whistles, natural sound transitions and noise approximation. Also with formant it is natural to express [color of noise](). It is a measure of how much the signal is pure, or focused, in frequency domain.

All that makes formant a versaile tool for describing singnals in practical sense.
In metaphorical sense, formant expresses harmony/chaos ratio, quality/quantity relation and a locally defined order of change.


## Related

> [audio-pulse](https://npmjs.org/package/audio-pulse) — declarative formants-based model of sound description.<br/>
> [audio-dsp coursera course](https://class.coursera.org/audio-002/wiki/week7) — coursera introductory class to digital signal processing for audio.<br/>
> [periodic-wave](https://webaudio.github.io/web-audio-api/#the-periodicwave-interface) — a way to define phasor in code.<br/>
> [stochastic harmonic oscillation]()