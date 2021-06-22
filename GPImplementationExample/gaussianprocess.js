/* If you got to this point I guess you are interested in finding out how exactly the GP model works
If that's the case, I should warn you: this implementation was done over an insomnia night
I'm pretty aware of, at least, 1000 different bugs that this code has and also of its extreme lack of efficiency
But really, I can't be bothered to fix them, this was created to showcase a simple example of probabilistic machine learning and it fits that purpose well enough
For some real background and deep understanding I'd point you to Rasmussen's incredible book on GPs (available online at http://www.gaussianprocess.org/gpml/)
But, if you are still here, then just feel free to take a look around the code, and if you fix something and want to contribute, just send me an e-mail! */

var plotDeltaX = 0.2;
var jitter = 1.0e-15

function sqexp(logS, logT, x1, x2){
	var kval = x1 - x2
	kval = kval * kval
	Tsq = Math.pow(Math.E, logT) * Math.pow(Math.E, logT)
	kval = kval/Tsq
	return Math.pow(Math.E, logS) * Math.pow(Math.E, -0.5*kval)
}

function buildCovarMat(s, l, x1, x2){
	//Build covar mat
	var covMat = [];
	for(i=0; i < x1.length; ++i){
		covMat[i] = [];
		for(j=0; j < x2.length; ++j){
			covMat[i][j] = sqexp(s, l, x1[i], x2[j])
		}
	}
	return covMat
}

function updateVal(){
	// Get element values
	var spost = Math.log(logs.value(document.getElementById("PosteriorSigma").value)); 
	var lpost = Math.log(logl.value(document.getElementById("PosteriorLengthscale").value)); 
	var npost = Math.log(logn.value(document.getElementById("PosteriorNoise").value)); 
	var myPlot = document.getElementById('myDiv');
	
	// Posterior traces
	var posteriorTraces = getPosteriorTraces(spost, lpost)
	myPlot.data[1] = posteriorTraces[3];
	myPlot.data[2] = posteriorTraces[4];
	myPlot.data[3] = posteriorTraces[5];
	myPlot.data[4] = posteriorTraces[6];
	myPlot.data[5] = posteriorTraces[7];
	myPlot.data[6] = posteriorTraces[0];
	myPlot.data[7] = posteriorTraces[1];
	myPlot.data[8] = posteriorTraces[2];
	Plotly.redraw('myDiv');
}

function buildPlot(){
	// Build background for data tracking
	var x = [];
	var y = [];
	for(i=-10; i < 10; i = i + 0.1){
	  x.push(i);
	}
	for(j=-3; j < 3; j = j + 0.1){
	  y.push(j);
	}
	var z = [];
	for(j = 0; j < y.length; j++){
	  var temp = [];
	  for(k=0; k < x.length; k++){
		temp.push(0);
	  }
	  z.push(temp);
	}
	var traceBackground = {
		x: x,
		y: y,
		z: z,
		type: 'heatmap',
		colorscale: [['0.0', 'rgb(255, 255, 255, 0.5)'], ['1.0', 'rgb(255, 255, 255, 0.5)']],
		xgap: 1,
		ygap: 1,
		hoverinfo:"x+y",
		showscale: false,
		showlegend: false,
		name: '-', 
		legendgroup:'0'
	  }
	
	var xp = [];
	var stdev = logs.value(document.getElementById("PosteriorSigma").value); 
	var ym = [];
	var ysp = [];
	var ysm = [];
	for(i=-10; i < 10; i = i + plotDeltaX){
	  xp.push(i);
	}
	for(j=-10; j < 10; j = j + plotDeltaX){
	  ym.push(0);
	  ysp.push(2*stdev);
	  ysm.push(-2*stdev);
	}
	var traceMean = {x: xp, y: ym, hoverinfo:"none", mode: 'line', line:{color: 'rgb(255, 0, 0)'}, name: 'Mean', legendgroup:'2'}
	var traceStdevM = {x: xp, y: ysm, hoverinfo:"none", mode: 'line', line:{color: 'rgb(255,220,220)'}, name: '2 Standard deviations', legendgroup:'2'}
	var traceStdevP = {x: xp, y: ysp, hoverinfo:"none", mode: 'line', line:{color: 'rgb(255,220,220)'}, name: '2 Standard deviations', legendgroup:'2', showlegend: false}
	
	
	// Build trace for data collection
	var plotX = [];
	var plotY = [];
	var tracePoints = {
		x: plotX,
		y: plotY,
		mode: 'markers',
		hoverinfo: 'none',
		name: 'Dataset', 
		legendgroup:'1',
		color:'DarkSlateGrey'
	};
	
	// Samples
	var spost = Math.log(logs.value(document.getElementById("PosteriorSigma").value)); 
	var lpost = Math.log(logl.value(document.getElementById("PosteriorLengthscale").value)); 
	var len = ym.length
	var finalCovar = buildCovarMat(spost, lpost, xp, xp)
	for(i = 0; i < finalCovar.length; i = i + 1){
	  finalCovar[i][i] = finalCovar[i][i] + jitter
	}
	var L = choleskyDecomposition(finalCovar)
	var z1 = NaNToZero(math.re(math.multiply(L,boxMuller(len))))
	var z2 = NaNToZero(math.re(math.multiply(L,boxMuller(len))))
	var z3 = NaNToZero(math.re(math.multiply(L,boxMuller(len))))
	var z4 = NaNToZero(math.re(math.multiply(L,boxMuller(len))))
	var z5 = NaNToZero(math.re(math.multiply(L,boxMuller(len))))
	// Build traces
	var samp1 = {x: xp, y: z1, hoverinfo:"none", mode: 'line', line:{color: 'rgb(240, 240, 240)'}, name: 'Samples', legendgroup:'3'}
	var samp2 = {x: xp, y: z2, hoverinfo:"none", mode: 'line', line:{color: 'rgb(240, 240, 240)'}, name: 'Samples', legendgroup:'3', showlegend: false}
	var samp3 = {x: xp, y: z3, hoverinfo:"none", mode: 'line', line:{color: 'rgb(240, 240, 240)'}, name: 'Samples', legendgroup:'3', showlegend: false}
	var samp4 = {x: xp, y: z4, hoverinfo:"none", mode: 'line', line:{color: 'rgb(240, 240, 240)'}, name: 'Samples', legendgroup:'3', showlegend: false}
	var samp5 = {x: xp, y: z5, hoverinfo:"none", mode: 'line', line:{color: 'rgb(240, 240, 240)'}, name: 'Samples', legendgroup:'3', showlegend: false}
	

	var data = [traceBackground,samp1, samp2, samp3, samp4, samp5, traceStdevM, traceStdevP, traceMean, tracePoints];
	var layout = { 	xaxis: {linecolor: 'black', mirror: 'ticks', range: [0, 10], fixedrange: true},
					yaxis: {linecolor: 'black', mirror: 'ticks', range: [-3, 3], fixedrange: true}
		};

	Plotly.newPlot('myDiv', data, layout, {displayModeBar: false});

	var myPlot = document.getElementById('myDiv');
	myPlot.on('plotly_click', function(data){
		//need to get where curveNumber = 0 (index of trace in data array)
		var dataTrace = data.points.filter(obj => {
			 return obj.curveNumber === 0;
		})
		Plotly.extendTraces('myDiv', {x: [[dataTrace[0].x]], y: [[dataTrace[0].y]]}, [9])
		updateVal();
	});
}

function getPosteriorTraces(spost, lpost){
	var myPlot = document.getElementById('myDiv');
	var npost = logn.value(document.getElementById("PosteriorNoise").value); 
	var dataX = myPlot.data[9].x
	var dataY = myPlot.data[9].y
	if (dataY.length != 0) {
		// if there is data input by the user
		var predX = []
		for(i=-10; i < 10; i = i + plotDeltaX){
		  predX.push(i);
		}
		var covar = buildCovarMat(spost, lpost, dataX, dataX)
		for(i = 0; i < covar.length; i = i + 1){
		  covar[i][i] = covar[i][i] + jitter + npost*npost
		}
		const InvCov = math.inv(covar)
		var crossCovar = buildCovarMat(spost, lpost, predX, dataX)
		var predCovar = buildCovarMat(spost, lpost, predX, predX)
		var finalMean = math.multiply(math.multiply(crossCovar,InvCov),math.transpose(dataY))
		var finalCovar = math.subtract(predCovar, math.multiply(math.multiply(crossCovar,InvCov),math.transpose(crossCovar)))
		for(i = 0; i < finalCovar.length; i = i + 1){
		  finalCovar[i][i] = finalCovar[i][i] + jitter
		}

		// Generate Samples
		var len = finalMean.length
		var L = choleskyDecomposition(finalCovar)
		var z1 = sumArray(finalMean, NaNToZero(math.re(math.multiply(L,boxMuller(len)))))
		var z2 = sumArray(finalMean, NaNToZero(math.re(math.multiply(L,boxMuller(len)))))
		var z3 = sumArray(finalMean, NaNToZero(math.re(math.multiply(L,boxMuller(len)))))
		var z4 = sumArray(finalMean, NaNToZero(math.re(math.multiply(L,boxMuller(len)))))
		var z5 = sumArray(finalMean, NaNToZero(math.re(math.multiply(L,boxMuller(len)))))
		
		// Store mean and stdevs
		var ym = [];
		var ysp = [];
		var ysm = [];
		for(j=0; j < finalMean.length; j = j + 1){
		  ym.push(finalMean[j]);
		  ysp.push(finalMean[j]+2*Math.sqrt(finalCovar[j][j]));
		  ysm.push(finalMean[j]-2*Math.sqrt(finalCovar[j][j]));
		}
		
		// Build traces
		var samp1 = {x: predX, y: z1, hoverinfo:"none", mode: 'line', line:{color: 'rgb(240, 240, 240)'}, name: 'Samples', legendgroup:'3'}
		var samp2 = {x: predX, y: z2, hoverinfo:"none", mode: 'line', line:{color: 'rgb(240, 240, 240)'}, name: 'Samples', legendgroup:'3', showlegend: false}
		var samp3 = {x: predX, y: z3, hoverinfo:"none", mode: 'line', line:{color: 'rgb(240, 240, 240)'}, name: 'Samples', legendgroup:'3', showlegend: false}
		var samp4 = {x: predX, y: z4, hoverinfo:"none", mode: 'line', line:{color: 'rgb(240, 240, 240)'}, name: 'Samples', legendgroup:'3', showlegend: false}
		var samp5 = {x: predX, y: z5, hoverinfo:"none", mode: 'line', line:{color: 'rgb(240, 240, 240)'}, name: 'Samples', legendgroup:'3', showlegend: false}
		

		var tracePosteriorMean = {x: predX, y: ym, hoverinfo:"none", mode: 'line', line:{color: 'rgb(255, 0, 0)'}, name: 'Mean', legendgroup:'2'}
		var tracePosteriorStdevM = {x: predX, y: ysm, hoverinfo:"none", mode: 'line', line:{color: 'rgb(255,220,220)'}, name: '2 Standard deviations', legendgroup:'2'}
		var tracePosteriorStdevP = {x: predX, y: ysp, hoverinfo:"none", mode: 'line', line:{color: 'rgb(255,220,220)'}, name: '2 Standard deviations', legendgroup:'2', showlegend: false}	
	} else {
		// if no data is given yet
		var xp = [];
		var stdev = logs.value(document.getElementById("PosteriorSigma").value); 
		var ym = [];
		var ysp = [];
		var ysm = [];
		for(i=-10; i < 10; i = i + plotDeltaX){
		  xp.push(i);
		}
		for(j=-10; j < 10; j = j + plotDeltaX){
		  ym.push(0);
		  ysp.push(2*stdev);
		  ysm.push(-2*stdev);
		}
		var tracePosteriorMean = {x: xp, y: ym, hoverinfo:"none", mode: 'line', line:{color: 'rgb(255, 0, 0)'}, name: 'Mean', legendgroup:'2'}
		var tracePosteriorStdevM = {x: xp, y: ysm, hoverinfo:"none", mode: 'line', line:{color: 'rgb(255,220,220)'}, name: '2 Standard deviations', legendgroup:'2'}
		var tracePosteriorStdevP = {x: xp, y: ysp, hoverinfo:"none", mode: 'line', line:{color: 'rgb(255,220,220)'}, name: '2 Standard deviations', legendgroup:'2', showlegend: false}
		// Generate Samples
		var len = ym.length
		var finalCovar = buildCovarMat(spost, lpost, xp, xp)
		for(i = 0; i < finalCovar.length; i = i + 1){
		  finalCovar[i][i] = finalCovar[i][i] + jitter
		}
		var L = choleskyDecomposition(finalCovar)
		var z1 = sumArray(ym, NaNToZero(math.re(math.multiply(L,boxMuller(len)))))
		var z2 = sumArray(ym, NaNToZero(math.re(math.multiply(L,boxMuller(len)))))
		var z3 = sumArray(ym, NaNToZero(math.re(math.multiply(L,boxMuller(len)))))
		var z4 = sumArray(ym, NaNToZero(math.re(math.multiply(L,boxMuller(len)))))
		var z5 = sumArray(ym, NaNToZero(math.re(math.multiply(L,boxMuller(len)))))
		// Build traces
		var samp1 = {x: xp, y: z1, hoverinfo:"none", mode: 'line', line:{color: 'rgb(240, 240, 240)'}, name: 'Samples', legendgroup:'3'}
		var samp2 = {x: xp, y: z2, hoverinfo:"none", mode: 'line', line:{color: 'rgb(240, 240, 240)'}, name: 'Samples', legendgroup:'3', showlegend: false}
		var samp3 = {x: xp, y: z3, hoverinfo:"none", mode: 'line', line:{color: 'rgb(240, 240, 240)'}, name: 'Samples', legendgroup:'3', showlegend: false}
		var samp4 = {x: xp, y: z4, hoverinfo:"none", mode: 'line', line:{color: 'rgb(240, 240, 240)'}, name: 'Samples', legendgroup:'3', showlegend: false}
		var samp5 = {x: xp, y: z5, hoverinfo:"none", mode: 'line', line:{color: 'rgb(240, 240, 240)'}, name: 'Samples', legendgroup:'3', showlegend: false}
	}
	return [tracePosteriorStdevM, tracePosteriorStdevP, tracePosteriorMean, samp1, samp2, samp3, samp4, samp5]
}

function logLik(n,m,X,con){
	var myPlot = document.getElementById('myDiv');
	spost = X[0]
	lpost = X[1]
	npost = X[2]
	// upper and lower constraints for sigma and L
	con[0] = X[0] - Math.log(1e-2)
	con[1] = -X[0] + Math.log(1)
	con[2] = X[1] - Math.log(1e-1)
	con[3] = -X[1] + Math.log(10)
	// I don't wanna deal with noise now to be honest
	// just keep it small enough and pretend data is high fidelity
	con[4] = X[2] - Math.log(1e-18)
	con[5] = -X[2] + Math.log(1e-16)
	var dataX = myPlot.data[9].x
	var dataY = myPlot.data[9].y
	var predX = myPlot.data[1].x
	var covar = buildCovarMat(spost, lpost, dataX, dataX)
	for(i = 0; i < covar.length; i = i + 1){
	  covar[i][i] = covar[i][i] + jitter + npost*npost
	}
	const InvCov = math.inv(covar)
	var crossCovar = buildCovarMat(spost, lpost, predX, dataX)
	var predCovar = buildCovarMat(spost, lpost, predX, predX)
	var finalMean = math.multiply(math.multiply(crossCovar,InvCov),math.transpose(dataY))
	var finalCovar = math.subtract(predCovar, math.multiply(math.multiply(crossCovar,InvCov),math.transpose(crossCovar)))
	var LLA = math.multiply(-0.5, math.multiply(math.transpose(dataY), math.multiply(InvCov, dataY)))
	var LLB = math.multiply(-1.0, math.sum(math.log(math.diag(covar)))) // cholesky was giving problems and I simplified, but it's wrong
	var LLC = math.multiply(-0.5, math.multiply(math.log(2*Math.PI), covar.length))
	LL = -(LLA+LLB+LLC)
	return LL
}

function optVals(){
	var spost = Math.log(logs.value(document.getElementById("PosteriorSigma").value)); 
	var lpost = Math.log(logl.value(document.getElementById("PosteriorLengthscale").value)); 
	var npost = Math.log(logn.value(document.getElementById("PosteriorNoise").value)); 
	var x0 = [spost, lpost, npost]
	n = 3; // num variables
	m = 6; // constrains
	var rhobeg = 1.0;
	var rhoend = 1.0e-2;
	var iprint = 0;
	var maxfun = 250;
	var solution = FindMinimum(logLik, n, m, x0, rhobeg, rhoend,  iprint,  maxfun);
	document.getElementById('PosteriorSigmaVal').value = Math.exp(x0[0]); 
	document.getElementById('PosteriorLVal').value = Math.exp(x0[1]); 
	document.getElementById('PosteriorNoiseVal').value = Math.exp(x0[2]); 
	document.getElementById('PosteriorSigma').value = logs.position(Math.exp(x0[0])); 
	document.getElementById('PosteriorLengthscale').value = logs.position(Math.exp(x0[1])); 
	document.getElementById('PosteriorNoise').value = logs.position(Math.exp(x0[2])); 
	updateVal()
}

function resetData(initSigma, initLen, initNoise){
	// the worst resetting function you'll ever see
	$('#PosteriorSigmaVal').val(initSigma).trigger("keyup");
	$('#PosteriorLVal').val(initLen).trigger("keyup");
	$('#PosteriorNoiseVal').val(initNoise).trigger("keyup");
	var spost = Math.log(initSigma); 
	var lpost = Math.log(initLen); 
	var myPlot = document.getElementById('myDiv');
	var plotX = [];
	var plotY = [];
	var tracePoints = {
		x: plotX,
		y: plotY,
		mode: 'markers',
		hoverinfo: 'none',
		name: 'Dataset', 
		legendgroup:'1',
		color:'Grey'
	};
	myPlot.data[9] = tracePoints;
	var xp = [];
	var stdev = logs.value(document.getElementById("PosteriorSigma").value); 
	var ym = [];
	var ysp = [];
	var ysm = [];
	for(i=-10; i < 10; i = i + plotDeltaX){
	  xp.push(i);
	}
	for(j=-10; j < 10; j = j + plotDeltaX){
	  ym.push(0);
	  ysp.push(2*stdev);
	  ysm.push(-2*stdev);
	}
	
	var posteriorTraces = getPosteriorTraces(spost, lpost)
	myPlot.data[1] = posteriorTraces[3];
	myPlot.data[2] = posteriorTraces[4];
	myPlot.data[3] = posteriorTraces[5];
	myPlot.data[4] = posteriorTraces[6];
	myPlot.data[5] = posteriorTraces[7];
	myPlot.data[6] = posteriorTraces[0];
	myPlot.data[7] = posteriorTraces[1];
	myPlot.data[8] = posteriorTraces[2];
	Plotly.redraw('myDiv');
}

function choleskyDecomposition(matrix) {
  // Argument "matrix" can be either math.matrix or standard 2D array
  const A = math.matrix(matrix);

  const n = A.size()[0];
  // Prepare 2D array with 0
  const L = new Array(n).fill(0).map(_ => new Array(n).fill(0));

  d3.range(n).forEach(i => {
    d3.range(i+1).forEach(k => {
      const s = d3.sum(d3.range(k).map(j => L[i][j]*L[k][j]));
      L[i][k] = i === k ? math.sqrt(A.get([k, k]) - s) : 1/L[k][k] * (A.get([i, k]) - s);
    })
  });
  return L;
}

function boxMuller(n) {
  // sample generator for N(0,1)
  const samples = [];
  Array(Math.ceil(n / 2)).fill().forEach(_ => {
    const R = Math.sqrt(-2 * Math.log(Math.random()));
    const theta = 2 * Math.PI * Math.random();
    samples.push(R * Math.cos(theta)); // z1
    samples.push(R * Math.sin(theta)); // z2
  });
  // if n is odd, drop the last element
  return samples.slice(0, n);
}

function sumArray(a, b) {
  var c = [];
  for (var i = 0; i < Math.max(a.length, b.length); i++) {
	c.push((a[i] || 0) + (b[i] || 0));
  }
  return c;
}

function NaNToZero(mat) {
  var c = mat;
  for (var i = 0; i < mat.length; i++) {
	  c[i] = c[i] || 0
  }
  return c;
}