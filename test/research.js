/**
 * Various tasks to decide on API
 */

var createNoglShader = require('nogl-shader-output');
var createGlShader = require('gl-shader-output');
var test = require('tst');


test('How to organize additive noise buffer?', function () {
	/**
	 * Result1: try column processing. That exhibits fast result.
	 */


	/**
	 * Precalc 512x512 buffer, how much it is slow?
	 *
	 * Result: 3.5ms × N formants per 1s-buffer.
	 * Not vey cheap, considering for 512 formants it is 1500ms.
	 * 	Well actually faster, just 255ms, but quite pricey still.
	 * Would be nice to precalc it in shaders. HOW?
	 * 	Formant lines are independent, so would be nice to precalc these lines somehow.
	 *
	 */
	test('Calc 512x512 additive steps noise', function () {
		var max = 44100/512;

		for (var i = 0; i < max; i++) {
			var prev = 0;
			var arr = Array(512*512);
			for (var j = 0; j < 512; j++) {
				for (var k = 0, off; k < 512; k++) {
					off = j*512+k;
					arr[off] = prev + Math.random();
					prev = arr[off];
				}
			}
		}
	});

	/**
	 * Consider also that 512ms is a tiny unrecognizable piece, you could just precalc average noise once for the fragment.
	 *
	 * Result: It is to a power cheaper. So seems that noise buffer is ok to be averaged.
	 * 	Though the sharp transitions... need to be tested.
	 * And still - we have to populate the array with that averaged value :/
	 */
	var buf = [];
	for (var i = 0; i < 512*512; i++) {
		buf[i] = Math.random();
	}
	test('Calc average for noise buffer', function () {
		var arr = Array(512);
		for (var i = 0; i < 512; i++) {
			var sum = 0;
			for (var j = 0; j < 512; j++) {
				sum += buf[i*512 + j];
			}
			arr[i] = sum / 512;
		};
	});

	/**
	 * How intense to run 1xN shader - for each point, 44100 times a second?
	 *
	 * Result: there is no difference.
	 * Running shader a fucking lot of column-times is practically the same (in some cases) as running it on a texture. And for 512x512 texture it is ~700ms.
	 * So can we say that we can run a single-column processor?
	 * 	That is still incredibly slow as fuck. We need ideally 15ms delay.
	 *
	 * Strangely it appears that 1px column-processing is up to 2 times more profitable than huge chunk processing. In some cases.
	 *
	 * That seems to be a limit of GPU processing. Not bad tho - 512x512 exhibits ~100 fps by fact.
	 */
	test.only('1xN draw', function () {
		var src = `
			precision highp float;

			uniform float prev;

			void main () {
				gl_FragColor = prev + vec4(0);
			}
		`;


		test('pure cycle 1x512x44100', function () {
			var prev = 1;
			for (var i = 0; i < 512; i++) {
				var res = [];
				for (var j = 0; j < 44100; j++) {
					var data = {prev: prev}
					res.push(data.prev);
				}
			}
		});

		var drawNogl = createNoglShader(src, {
			width: 1,
			height: 512
		});
		var drawGl = createGlShader(src, {
			width: 1,
			height: 512
		});

		var max = 44100;

		test('nogl 1x512x44100', function () {
			for (var i = 0; i < max; i++) {
				drawNogl({
					prev: 1
				});
			}
		});
		test('gl 1x512x44100', function () {
			for (var i = 0; i < max; i++) {
				drawNogl({
					prev: 1
				});
			}
		});


		test('nogl 512x1x44100', function () {
			for (var i = 0; i < max; i++) {
				drawNogl({
					prev: 1
				});
			}
		}).before(function () {
			drawNogl = createNoglShader(src, {
				width: 512,
				height: 1
			});
		});
		test('gl 512x1x44100', function () {
			for (var i = 0; i < max; i++) {
				drawNogl({
					prev: 1
				});
			}
		}).before(function () {
			drawGl = createGlShader(src, {
				width: 512,
				height: 1
			});
		});

		//compare to normal run
		var times = 44100/512;
		test('gl 512x512x' + times, function () {
			for (var i = 0; i < times; i++) {
				drawGl({
					prev: 1
				});
			}
		}).before(function () {
			drawGl = createGlShader(src, {
				width: 512,
				height: 512
			});
		});
		test('nogl 512x512x' + times, function () {
			for (var i = 0; i < times; i++) {
				drawNogl({
					prev: 1
				});
			}
		}).before(function () {
			drawNogl = createGlShader(src, {
				width: 512,
				height: 512
			});
		});

		//compare to long run
		var fold = 44100/8
		test('gl 512x' + fold, function () {
			for (var i = 0; i < 8; i++) {
				drawGl({
					prev: 1
				});
			}
		}).before(function () {
			drawGl = createGlShader(src, {
				width: fold,
				height: 512
			});
		});
		test('nogl 512x' + fold, function () {
			for (var i = 0; i < 8; i++) {
				drawNogl({
					prev: 1
				});
			}
		}).before(function () {
			drawNogl = createGlShader(src, {
				width: fold,
				height: 512
			});
		});
	});
});


test('What’s our plan on rendering via shaders?', function () {
	/**
	 * Goal: find an efficient way to render formants.
	 * see gl-experiment/texture-render-to-input for pingpong experiments.
	 *
	 * Options:
	 * - we can use scissors to show target area to render.
	 * - we can use texSubImage to specify input texture subarea.
	 * - we can define multiple texture outputs as gl_FragData if we need. Useful for multichannels I guess (drawbuffers)
	 * - we can pingpong shaders, framebuffers, textures, its pricey though.
	 *
	 * Result:
	 * @ref see gl-experiment texture-* for explanations. Final research is texture-vertex. It shows the main strategy of rendering. Pretty fast - 150ms for 512x512 sound buffer. PLacing rendered noise into varyings.
	 */
});