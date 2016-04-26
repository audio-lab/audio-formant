> Convert [formants](formants ref) to audio.

To understand the idea behind formants read [formants ref](). Briefly, formant is HSL color model applied to sound, where each sound fragment is presented with "pixel", aka formant, comprised of _frequency_, _amplitude_, _quality_ and _panning_ channels. In that, any image can be regarded as sound texture and reproduced in sound. That allows for creating natural lightweight "soundprints".

Converting formants data to audio is the purpose of this package.

## Usage

[![npm install audio-formant](https://nodei.co/npm/audio-formant.png?mini=true)](https://npmjs.org/package/audio-formant/)

```js
var createFormant = require('audio-formant');

//create formant converter instance
var formant = createFormant({
	//gl context, created if omitted
	gl: gl,

	//output buffer size
	samplesPerFrame: 512,

	//output number of channels
	channels: 2,

	//sample rate of output audio chunk
	sampleRate: 44100
});


//set formants data
formant.data(arr);

//fill array with audio data corresponding to current formant texture
formant.populate(arr);

//stream formant to audio stream, e. g. audio-speaker
formant.pipe(audioStream);



//WebGL textures used in rendering process.
//Can be rendered to, sent a new data to or read from.

//input formant values
formant.textures.formants;

//input noise samples for uncertainty param
formant.textures.noise;

//input source primitives
formant.textures.source;

//output signal phases
formant.textures.phase;

//output sampled waveforms, unmerged
formant.textures.waveform;

//output single waveform, merged into channels
formant.textures.output;
```


## Scheme

The process of generating sound is based on WebGL, as it renders the best performance among other technologies (web audio API, streams, web-workers), due to highly parallel nature and low-level interpolating.

[image]

The sound is produced by picking samples from a sound source (like sine wave, saw or complex wav file) based on sequence of phase values. Phase values are generated from _frequency_ and _quality_ formant channels and `sampleRate`.

The scheme comprises 5 shaders:

1. _even and odd shaders_ to render even and odd chunks of phase info.
2. _merging shader_ to merge chunks into a single phase texture.
3. _sampling shader_ to sample source values based on the phase texture.
4. _copying shader_ to save phase info back into odd shader.

The principle is generating additive noise steps and putting them to varyings, like so:
[image]

First, we generate 29px of noise samples chunks. We restrict viewport to 0..32 (we should use 2^n textures) and step over buffer with shift multiple of 29 - the number of varyings.

[image]

Then we merge even/odd chunked phase info into a single seamless phase texture.

[image a + b → phase]

Then we sample phase from the source

[phase + source → signal]

That’s basically it. We just save phase info back to odd buffer to provide seamless connection with the next buffer.




## Formant

Formant is a sound primitive, able to describe/produce atomic signal oscillation in terms of _frequency_, _magnitude_ and _quality_. It is like HSL color space, but for sound, where H stands for frequency, S for quality and L for intensity.

Formant is a concept of [HSL color model](), applied to a [stochastic harmonic model](), which takes benefits of both. To grasp the idea, imagine a bandpass filter applied to the white noise.

_Frequency_ is similar to the notion of frequency in [phasor](https://en.wikipedia.org/wiki/Phasor), but it is expressed in unitless relative manner. _0_ is a constant level, _1_ is a fundamental frequency _f0_, _0.5_ — half of _f0_, 2 — twice of _f0_, etc. By that, frequency can relate one formant to other as overtone or modulation, and can be rendered into any needed pitch. Intuitively frequency displays massiveness, as more massive objects expose lower frequencies, see [simple harmonic motion](https://en.wikipedia.org/wiki/Simple_harmonic_motion).

_Magnitude_ reflects the intensity of oscillation. It multiplies, or masks, the amplitude. As any oscillation is a transformation between two forms of energy, magnitude reflects the total energy being distributed in oscillator, which can be seen as maximum deviation, or disbalance, in one of these two forms, or the length of phasor vector in general. In sound-producing world, it is often expressed in terms of ADSR, but in general it may take form of any _f(t)_.

_Quality_ is similar to notion of [quality factor](https://en.wikipedia.org/wiki/Q_factor), normalized to range 0..1. By setting the quality to 1 a formant becomes a pure harmonic, by setting it to 0 the formant becomes a pure white noise. Everything in between is a [degree of freedom](https://en.wikipedia.org/wiki/Degrees_of_freedom_(mechanics)) with fuzzy frequency (can be understood as a Helmholtz resonator with unstable volume), which makes it good for description breath-related sounds, like flutes, whistles, natural sound transitions and noise approximation. Also with formant it is natural to express [colour of a noise](). It is a measure of how much the signal is pure, or focused, in frequency domain.

_Time_ is the glueing factor for all the three previous concepts, normalized to the range 0..1. That creates start and end of the variation, or introduces the periodicity. It makes that variation discernable from others. Also along with the quality factor it makes the notion of phase irrelevant, as the phase reflects the delay. For _Q < 1_ frequency can take random value, and for combination of formants with Q = 1 change of the phase of any of them is unnoticeable to the listener ([prove]()).

All that makes formant a versaile tool for describing singnals in practical sense.
In metaphorical sense, formant expresses harmony/chaos ratio, quality/quantity relation and a locally defined order of change.

Criterions of a formant:

* Low autocorrelation. That means that formant does not contain repetitions within itself.
* Beginning and end, or more generically, ADSR character.
* Unability to be stretched, only scaled.
* No absolute external units introduced, i. e. formant is fully normalized through itself.


## Questions

* Do we really need time? It expresses variation and relation, which can be delegated to pulse.
	* Time expresses relative stretch, eg. the sky, which is a single formant with changing color. It is impossible with pulse, which would define three timeless formants instead.
	* It expresses simple variation, eg swipe, where frequency is simply moved. With pulses it would be two formants, antialiased or alike.
	* It may express sine variation, like a changing color of a sky.
	* So yes, we need time to show simple variation.


## Related

> [audio-pulse](https://npmjs.org/package/audio-pulse) — declarative formants-based model of sound description.<br/>
> [audio-dsp coursera course](https://class.coursera.org/audio-002/wiki/week7) — coursera introductory class to digital signal processing for audio.<br/>
> [periodic-wave](https://webaudio.github.io/web-audio-api/#the-periodicwave-interface) — a way to define phasor in code.