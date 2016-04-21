/**
 * Q: how can we use the fact that noise varying samples are calculated 3 times per triangle, for each vertex?
 *
 */


/**
 * Q: how can we organize summing of outputs from the renderer? Audio-buffers stack or some webgl-merging?
 * A: both, but merging seems pretty easy: just pass the output texture to merging shader and that’s it.
 * 	- btw WAA mixing seems to be flawed. It clips values over 0.5.
 * 		- the simple way - to distribute the energy within the chunk.
 * 	- ✔ also we already have merging shader, so just sum up values.
 */


/**
 * Q: how can we organize storing previous offset?
 * A: ✔ we have 29 varyings but 32 spots in texture, so just store offsets in 3 remain spots
 */


/**
 * Q: how can we organize uninterruptible speaker? When GC delays the sound, but not blocks it?
 * 	A: we should put repeatable chunks into a set of audio-buffers connected to output.
 * 		Q: what’s the minimal width of repeatable chunk?
 * 			A: with pure sine - one period.
 * 				- with unstable noisy sine about a second i guess?
 * 				Q: inacceptible. How to make it less?
 * 					- we can try to repeat period of a sine
 * 						- but that would create repeating unpleasant noise
 * 					- ideally we put a set of pure sines acc to freq characteristic
 * 						- that breaks noises, but purifies sound...
 */


/**
 * Q: what is faster - switching framebuffer or rebinding texture?
 * A: does not matter, both seem to be fast
 */


/**
 * Q: What is difference between relative and absolute frequency?
 * A: relative shows relation within the formant tuple, absolute shows formant’s main frequency
 * Q: Which one should we use here?
 * A: Use absolute, because relative is business-logic dependent, controlled by pulse
 */


/**
 * Q: How quality is related with steps/frequency/range?
 * A: best of all to use natural representation 0..∞
 */