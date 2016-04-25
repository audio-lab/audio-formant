
## Q: how can we use the fact that noise varying samples are calculated 3 times per triangle, for each vertex?




## Q: how can we organize summing of outputs from the renderer? Audio-buffers stack or some webgl-merging?
A: both, but merging seems pretty easy: just pass the output texture to merging shader and that’s it.
	- btw WAA mixing seems to be flawed. It clips values over 0.5.
		- the simple way - to distribute the energy within the chunk.
	- ✔ also we already have merging shader, so just sum up values.




## Q: how can we organize storing previous offset?
A: ✔ we have 29 varyings but 32 spots in texture, so just store offsets in 3 remain spots




## Q: how can we organize uninterruptible speaker? When GC delays the sound, but not blocks it?
	A: we should put repeatable chunks into a set of audio-buffers connected to output.
		Q: what’s the minimal width of repeatable chunk?
			A: with pure sine - one period.
				- with unstable noisy sine about a second i guess?
				Q: inacceptible. How to make it less?
					- we can try to repeat period of a sine
						- but that would create repeating unpleasant noise
					- ideally we put a set of pure sines acc to freq characteristic
						- that breaks noises, but purifies sound...




## Q: what is faster - switching framebuffer or rebinding texture?
A: does not matter, both seem to be fast




## Q: What is difference between relative and absolute frequency?
A: relative shows relation within the formant tuple, absolute shows formant’s main frequency
Q: Which one should we use here?
A: Use absolute, because relative is business-logic dependent, controlled by pulse




## Q: How quality is related with steps/frequency/range?
	- natural representation 0..∞ is related with existing concept
		- it is also good cause it is relative
			i. e. sounds equally for any value of tonic
	- 0..1 is good for packing a texture




## Q: what is the architecture?
1. it is stream. Speaker (or destination) asks for a data. We ask connected pulse for a new state.
	Q: but how do we provide accurate control over passed params faqp?
		- ideally we implement full sound logic in formants. Yes, delays etc should be processed by pulse shaders.
		- formants are basically just time-bound values, eg change 5th formant on 5.1s
2. It provides pulses' composition in scene graph. Each pulse’s duration is presented via vertex, as well as every style parameter. Each pulse’s vertex with variation of style creates a separated vertex. Pulse verteces are placed in a space of rendered sound, with the sample rate of output buffer - so yeah, pulse space is sliced via transformation matrix, but rendered to asked chunk and then vocalized.
	- That allows for storing pulse graph as a set of vertex coords with style values for them, very concise, and flexible - allows to make generalizations on input sound etc.
	- It sends pulse’s sources to formant-sound source texture.

## Q: should we oversample formant values to send to formant-sound (pass formant state textures) - or should we pass single-like values?
	- First allows for good control, but takes time to load textures up.
	- Second allows for using buffers, which might be somewhat faster as it only reads... what?
	- Even if the formant is absent for current timeslice, it is in the state texture still...


## Q: formant-sound asks for a next formant chunk. should it be blocked and wait while pulse returns a new state?
 A: no, it should release data instantly based on the last state.
 Q: so pulses should send data loosely - how can they know when to send new state?
 A: ideally pulse just renders a texture, so that formant-sound just takes it as input.
 Q: so who is first and how should be time-flow controlled: by speaker or by user input?
 A: formant-sound should definitely be a stream, at least readable, to be connectable to speaker and stuff.
 	But during the rendering sound buffer, it should ask connected pulse to render state texture, where x is single formant values, y is other formants. In this case we have the most precise control over the formant states, and even if it does not change - for webgl it is not a big deal to render a texture.

## Q: how pulse finds out the time slice to render?
 	- Ideally we render slice by setting transformation matrix or viewport.
 		The second is preferrable as it does not force uniforms to take place.
   			But the max canvas width is 8192, so we cannot set huge canvas.

## Q: What if just to place verteces in space and control their transformation matrix?
	- Our viewport is always a chunk size to send to formant-sound, which just takes a slice of that vertex tree?
	Q: Shuld we set sources right to vertex tree, or they have to be formants? We could prerender formant waveforms and place them in space...
		+ We could render slice right in the merging stage of formant-sound. That would allow for avoiding iterating over varyings chunks - we could just merge needed set of sounds.
		- That takes rendering formant in the pulse’s output, not in the end.
		- There’s actually no big difference: we still go by a superposition of pulses (which are verteces), the only difference is that we ignore hidden ones.
		- That also makes trickier realtime rendering if we have to take user input.
		- Also reproducing stream of formants like audio-file is difficultier.
	That is definitely a good idea - hidden pulses will be ignored.
	Q: The question is - should we render each pulse individually or we should render bunch of pulses at once?
		- Definitely the second one, because hidden pulses will be ignored.





## Q: how should we place too lengthy sources?
A: Ideally - place to texture, even separated by lines (thats ok), but as far we use sprites - we should king of define source coords.





## Q: What is faster - switching gl to program and texture and rendering it or running analogous js-sctipt, eg multiplying matrices?




## Q: what is the pulse’s rendering flow?
- It’s output texture is NxM formant states. It takes all nested pulses result as textures inputs and lays them over.
	The max number of uniforms is 256 - that is the max number simultaneously processed textures. Minus formant-sound uniforms, minus style uniforms.
 - It can be extended by merging textures into sprites. For example, one pulse renders all it’s children to own sprite, so we only need 256 root pulses. Or even just one generic sprite for all pulses.
 	- Though it makes impossible for pulses to eat it’s own shit (take output as input). So we can shorten number of textures to the level of depth - same-level textures cannot read it’s own result, only render it, but upper level can read it.
 - Biggest texture size is 8192 (because x4 that is uint max value), that’s the biggest chunk size, not the whole rendering result.




## Q: how do we send style’s source to formant? How that understands the number of source or source texture?
- ✔ we can reserve in source sprite numbers for indexes of our pulses. We need to pass source file on formant-sound init then.




## Q: Can we use DOM for keeping structure of sound, instead of reproducing it?
	- In DOM we cannot read bg of an element;
	- DOM is difficult to reproduce in node;
		+ there is a dom-lite tho, works perfectly with esdom.
	+ DOM has bonuses like id’s, classes, queries, attributes, data, etc.
	+ With DOM we could also delegate sound structure visualizing straight to DOM, avoiding WebGL.
	- To render sound we still have to connect them to rendering process like formant-sound, if not to duplicate structure.
