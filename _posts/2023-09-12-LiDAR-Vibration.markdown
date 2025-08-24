---
layout: post
title:  "Can your iPhone LiDAR measure vibrations? A friendly dive into modal analysis"
date:   2023-09-12 10:00:00 +0100
categories: [LiDAR, Modal Analysis, Structural Health Monitoring]
published: true
---

If you’ve ever wondered what that little black circle on the back of your iPhone does besides taking cool portrait shots, you’re not alone.  The latest iPhone Pro models come with a tiny LiDAR sensor that measures depth by timing how long it takes light to bounce back.  It’s meant for augmented reality, but could it also double as a vibration sensor?  That’s exactly what a recent paper by Gledson Tondo, Charles Riley and Guido Morgenthal set out to explore:contentReference[oaicite:0]{index=0}.

Instead of taking these devices at face value, the authors put the iPhone 13 Pro’s LiDAR through its paces.  They looked at how far away it needs to be, how much noise it makes and how to squeeze proper modal parameters out of it.  Along the way they used a laser displacement transducer (LDT) as a gold‑standard reference and even tried a full modal test on a tall cantilever beam.  This post follows their journey and keeps things relaxed and conversational.

<!--excerpt-->
## What’s hiding inside your iPhone’s camera bump?

First things first: what exactly is this LiDAR gadget?  Inside the camera cluster sits a teeny vertical‑cavity surface‑emitting laser (VCSEL) array and a companion single‑photon avalanche diode (SPAD) detector:contentReference[oaicite:1]{index=1}.  It fires out nine points of light in a 3×3 grid, sweeps them across roughly a 60°×48° field of view and collects 576 raw depth samples.  Apple doesn’t let you touch those directly, though.  Their ARKit framework fuses the raw depths with RGB data from the wide‑angle lens to give you a 256 × 192 depth map at 60 Hz:contentReference[oaicite:2]{index=2}.

<!-- Placeholder for camera cluster image -->
![iPhone camera cluster showing LiDAR placement](path/to/lidar_camera_placeholder.png){: .center-image }

This fusion is great for making augmented reality scenes look crisp, but it also means the real sampling rate and noise characteristics aren’t obvious.  Knowing how often the depth values are actually updated and how much post‑processing goes on behind the scenes is the key to using the sensor for engineering measurements.

## Checking the sensor in still mode

### How they set it up

To see how the LiDAR behaves when nothing is moving, the team pointed the phone at a black rectangular plate mounted on a stand:contentReference[oaicite:3]{index=3}.  They collected 300 depth maps at different separations and checked the average and standard deviation of the central pixel.  Not everything in the frame was equally reliable – the top border, where the plate ran out and the background peeked through, was noticeably noisier:contentReference[oaicite:4]{index=4}.

<!-- Placeholder for static setup photo -->
![Static measurement setup](path/to/static_setup_placeholder.png){: .center-image }

### Finding the sweet spot

How close is too close?  They found that standing about 30 cm away was the sweet spot: the measurements were basically unbiased and the standard deviation was only about 0.05 cm, which works out to an SNR of roughly 55 dB:contentReference[oaicite:5]{index=5}.  Move back to around 40 cm and the noise level stays low, but shove the phone right up against the plate and both bias and noise blow up.  Table 1 summarises the numbers they reported.

| Distance [cm] | Mean depth [cm] | Standard deviation [cm] | SNR [dB] |
|--------------:|----------------:|------------------------:|---------:|
| 12           | 15.4           | 0.65                   | 27.6    |
| 20           | 22.6           | 0.10                   | 46.7    |
| **30**       | **29.9**       | **0.05**               | **55.5**|
| 40           | 39.7           | 0.03                   | 63.0    |
| 100          | 100.1          | 0.09                   | 61.4    |

Lighting also made a surprising difference.  With normal room lighting the depth map looked crisp and the variance stayed low.  Switch the lights off and everything got murky – probably because Apple’s depth‑RGB fusion works better when the camera sees something:contentReference[oaicite:6]{index=6}.

## Shaking things up

### So, how does it handle vibrations?

Next they clamped the same plate to a fancy air‑bearing shaker that can wiggle back and forth at controlled frequencies.  A laser displacement transducer recorded a ground‑truth signal while the LiDAR watched from 35 cm away:contentReference[oaicite:7]{index=7}.

<!-- Placeholder for dynamic setup photo -->
![Dynamic measurement setup](path/to/dynamic_setup_placeholder.png){: .center-image }

Running a sweep of pure harmonic oscillations, they compared the root‑mean‑square (RMS) displacement measured by both sensors.  Up to roughly 10 Hz the curves matched nicely:contentReference[oaicite:8]{index=8}.  Above that, the LiDAR started to exaggerate the motion because of aliasing and extra noise.  When they fed the shaker a broadband signal (1–60 Hz), the LiDAR did a decent job capturing the overall power spectral density but showed a bump at very low frequencies (~1 Hz) and a dip around 15 Hz:contentReference[oaicite:9]{index=9}.

The noise floor at the centre pixel came out at about 5.3 mm/\(\sqrt{\text{Hz}}\) at 1 Hz and dropped off as frequency increased:contentReference[oaicite:10]{index=10}.  That’s a lot higher than what you’d expect from a dedicated displacement sensor, so you either need big vibrations or a good filter.

### How far can you stand back?

They repeated the harmonic test at different distances to see how far you could be and still get meaningful data.  Everything stayed within about 2 % error up to 1.5 m.  Push it to 2 m and the error climbs to around 11 %, and at 3 m the depth map can’t reliably see the plate any more:contentReference[oaicite:11]{index=11}.

### A surprise about sampling rate

Here’s the quirky part: even though ARKit spits out depth maps at 60 Hz to match the RGB camera, the LiDAR hardware only samples at 15 Hz.  Apple fills in the gaps by upsampling, which mirrors the spectrum around the Nyquist frequency of 7.5 Hz:contentReference[oaicite:12]{index=12}.  That means anything above 7.5 Hz folds back into the lower range.  For example, a 12.5 Hz signal masquerades as 2.5 Hz, and 25 Hz folds to 5 Hz.  You can still track these higher frequencies if you know what you’re looking for, but you’ll need to account for the alias:contentReference[oaicite:13]{index=13}.

## Giving the LiDAR a real job: modal testing

### Setting up a cantilever beam

To put the LiDAR to a more practical test, the authors mounted a 1.5 m tall steel cantilever (with a 16 mm × 2 mm cross‑section) on the shaker:contentReference[oaicite:14]{index=14}.  They placed the phone at the mid‑height of the beam, 1.5 m away, and let the shaker apply a random base excitation.  A laser measured base motion while the LiDAR captured the whole beam’s displacement field:contentReference[oaicite:15]{index=15}.

<!-- Placeholder for modal test setup photo -->
![Cantilever modal test setup](path/to/modal_setup_placeholder.png){: .center-image }

### Processing the data

Because the beam’s displacement lives along a line, they pulled out one column of depth pixels and clipped off the top where the beam sometimes left the field of view.  They also down‑sampled to 15 Hz to avoid aliasing.  Then they ran a covariance‑driven stochastic subspace identification (SSI) algorithm 1000 times, each time picking five heights at random using Latin hypercube sampling.  This Monte‑Carlo approach gave them distributions for the natural frequencies, damping ratios and mode shapes.

The first two natural frequencies identified from the LiDAR matched those from the laser transducer to within about 2 %:contentReference[oaicite:16]{index=16}.  Frequencies above the Nyquist limit showed up as aliases.  Damping ratios from the LiDAR tended to be higher because the noise acts like extra damping:contentReference[oaicite:17]{index=17}.

| Mode | True freq [Hz] (LDT) | Alias [Hz] in LiDAR | Mean LiDAR freq [Hz] | Notes |
|----:|----------------------:|---------------------:|----------------------:|------|
| 1   | 0.51                 | –                   | 0.50                 | Matches true value |
| 2   | 4.31                 | –                   | 4.45                 | Slightly higher |
| 3   | 12.48                | 2.52                | 2.55                 | Alias due to 15 Hz sampling |
| 4   | 24.57                | 5.43                | 5.48                 | Alias due to 15 Hz sampling |

By fitting a Gaussian process to the SSI‑derived mode shapes, they smoothed out the noisy results and obtained a mean shape with confidence bounds.  Comparing these to an analytical cantilever model showed excellent agreement for the first two modes (MAC > 0.9):contentReference[oaicite:18]{index=18}.  The higher modes had lower MAC values and larger uncertainties because of aliasing and noise.:contentReference[oaicite:19]{index=19}

## What we learned

If you’re thinking about using your iPhone’s LiDAR as a vibration sensor, here are the big takeaways:

* **Stay at a sensible distance:** keep the phone around 30 cm from what you’re measuring for static readings.  Too close and the readings get biased; too far and the noise climbs:contentReference[oaicite:20]{index=20}.
* **Light helps:** the depth‑RGB fusion does better when the camera sees something.  Turn the lights off and expect more noise:contentReference[oaicite:21]{index=21}.
* **Low‑frequency champion:** the LiDAR captures displacements faithfully up to about 10 Hz and distances up to 2 m:contentReference[oaicite:22]{index=22}.  Above 7.5 Hz you’ll run into aliasing because the true sampling rate is only 15 Hz:contentReference[oaicite:23]{index=23}.
* **Good for first modes:** for simple structures like cantilevers, you can extract the first two modal frequencies and shapes quite accurately.  Higher modes show up as aliases, and damping estimates are inflated due to noise:contentReference[oaicite:24]{index=24}.

Overall, the iPhone’s LiDAR is a fun and surprisingly capable tool for low‑frequency, low‑amplitude vibration studies – especially when you need a portable, non‑contact sensor.  It won’t replace proper measurement hardware any time soon, but with the right processing it can offer useful insight for education, quick diagnostics or hobby projects.  Future improvements in sampling rate, measurement range and access to raw depth points could make smartphone LiDAR a serious player in structural health monitoring:contentReference[oaicite:25]{index=25}.

---

*Citation:* This summary is based on Gledson Rodrigo Tondo, Charles Riley and Guido Morgenthal, “Characterization of the iPhone LiDAR‑Based Sensing System for Vibration Measurement and Modal Analysis,” *Sensors* **23** (2023) 7832:contentReference[oaicite:26]{index=26}.
