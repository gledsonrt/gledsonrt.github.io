<script>
// ------------------------------
// GP demo (optimised)
// ------------------------------

var plotDeltaX = 0.25;
var jitter      = 1.0e-1;

// Cache DOM once
var gpEl = document.getElementById('myDiv');

// Cache x* grid used across updates
var XP = (function makeXP(){
  var a = [], x=-10;
  for (; x < 10 - 1e-12; x += plotDeltaX) a.push(+x.toFixed(6));
  return a;
})();
var NX = XP.length;

// Small helpers (no allocations unless necessary)
function exp(x){ return Math.exp(x); }
function sq(x){ return x*x; }

// Squared-exponential kernel in log-parameterisation
// logS = log(σ_s^2)  [amplitude]
// logT = log(ℓ)      [lengthscale]
function k_se(logS, logT, xi, xj){
  var ell2 = exp(2*logT);
  return exp(2*logS) * Math.exp(-0.5 * sq(xi - xj) / ell2);
}

// Build K(X,X) (symmetric) — in-place lower triangle fill + mirror to save flops
function buildKxx(logS, logT, X){
  var n = X.length, K = new Array(n);
  for (var i=0;i<n;i++){ K[i] = new Array(n); }
  for (var i=0;i<n;i++){
    for (var j=0;j<=i;j++){
      var v = k_se(logS, logT, X[i], X[j]);
      K[i][j] = v;
      if (j !== i) K[j][i] = v;
    }
  }
  return K;
}

// Build K(X*, X) (rectangular)
function buildKxstarX(logS, logT, Xstar, X){
  var nstar = Xstar.length, n = X.length, K = new Array(nstar);
  for (var i=0;i<nstar;i++){
    var row = new Array(n); K[i] = row;
    var xi = Xstar[i];
    for (var j=0;j<n;j++){
      row[j] = k_se(logS, logT, xi, X[j]);
    }
  }
  return K;
}

function symmetriseInPlace(A){
  var n = A.length;
  for (var i=0;i<n;i++) for (var j=i+1;j<n;j++){
    var v = 0.5*(A[i][j] + A[j][i]);
    A[i][j] = v; A[j][i] = v;
  }
}

// Cholesky (lower) for SPD matrix (plain JS, minimal allocations)
function chol(A) {
  // A is a plain 2D array, SPD
  var n = A.length, L = new Array(n);
  for (var i=0;i<n;i++) L[i] = new Array(n).fill(0);

  for (var i=0;i<n;i++){
    for (var k=0;k<=i;k++){
      var s = 0.0;
      for (var j=0;j<k;j++) s += L[i][j]*L[k][j];
      var val = A[i][k] - s;
      if (i === k){
        // clamp small negatives from round-off
        if (val < 0 && val > -1e-12) val = 0;
        if (val <= 0){
          // final safety: inject tiny nugget to continue
          val = 1e-12;
        }
        L[i][k] = Math.sqrt(val);
      } else {
        L[i][k] = val / L[k][k];
      }
    }
  }
  return L;
}

// Forward/Backward solves (L y = b, L^T x = y)
function fwdSub(L, b){
  var n = L.length, y = new Array(n);
  for (var i=0;i<n;i++){
    var s = b[i];
    for (var j=0;j<i;j++) s -= L[i][j]*y[j];
    y[i] = s / L[i][i];
  }
  return y;
}
function bwdSub(L, y){ // solve L^T x = y
  var n = L.length, x = new Array(n);
  for (var i=n-1;i>=0;i--){
    var s = y[i];
    for (var j=i+1;j<n;j++) s -= L[j][i]*x[j];
    x[i] = s / L[i][i];
  }
  return x;
}

// Matrix–vector and matrix–matrix small helpers
function matVec(A, x){
  var n = A.length, m = A[0].length, y = new Array(n);
  for (var i=0;i<n;i++){
    var s = 0.0, row = A[i];
    for (var j=0;j<m;j++) s += row[j]*x[j];
    y[i] = s;
  }
  return y;
}
function solveKalphaEqualsY(L, y){ // (LL^T) α = y
  return bwdSub(L, fwdSub(L, y));
}

// Solve V = L \ K (where L is lower, K is (n×m))
// Returns V with same shape as K
function solveLowerMat(L, K){
  var n = L.length, m = K[0].length;
  var V = new Array(n);
  for (var i=0;i<n;i++){
    V[i] = new Array(m);
    for (var k=0;k<m;k++){
      var s = K[i][k];
      for (var j=0;j<i;j++) s -= L[i][j]*V[j][k];
      V[i][k] = s / L[i][i];
    }
  }
  return V;
}

// Compute column-wise squared norms of M (n×m) — returns length m
function colSqNorms(M){
  var n = M.length, m = M[0].length, out = new Array(m).fill(0);
  for (var i=0;i<n;i++){
    var row = M[i];
    for (var j=0;j<m;j++) out[j] += row[j]*row[j];
  }
  return out;
}

// Random N(0,1) vector of length n
function stdNormal(n){
  var z = new Array(n), i=0;
  for (; i+1<n; i+=2){
    var u1 = Math.random(), u2 = Math.random();
    var r = Math.sqrt(-2*Math.log(u1)), th = 2*Math.PI*u2;
    z[i]   = r*Math.cos(th);
    z[i+1] = r*Math.sin(th);
  }
  if (i<n){ z[i] = (function(){ var u1=Math.random(),u2=Math.random(),r=Math.sqrt(-2*Math.log(u1)),th=2*Math.PI*u2; return r*Math.cos(th); })(); }
  return z;
}

// Multiply (n×m) matrix by vector (length n), returning length m: (A^T b)
function matTvec(A, b){
  var n = A.length, m = A[0].length, out = new Array(m).fill(0);
  for (var i=0;i<n;i++){
    var bi = b[i], row = A[i];
    for (var j=0;j<m;j++) out[j] += row[j]*bi;
  }
  return out;
}

// Global traces (avoid reallocating on every update)
var traceBackground, traceMean, traceStdevM, traceStdevP,
    samp1, samp2, samp3, tracePoints;

// Build once
function buildPlot(){
  // Background grid (optional visual helper)
  var X = [], Y = [];
  for (var i=-10;i<10;i+=0.1) X.push(+i.toFixed(6));
  for (var j=-3;j<3;j+=0.1)  Y.push(+j.toFixed(6));
  var Z = new Array(Y.length);
  for (var r=0;r<Y.length;r++){ Z[r] = new Array(X.length).fill(0); }

  traceBackground = {
    x: X, y: Y, z: Z, type: 'heatmap',
    colorscale: [['0.0','rgba(255,255,255,0.5)'], ['1.0','rgba(255,255,255,0.5)']],
    xgap: 1, ygap: 1, showscale: false, showlegend: false, name: '-', legendgroup: '0'
  };

  // Prior bands and mean (placeholders; filled in updateVal)
  traceMean   = { x: XP.slice(), y: new Array(NX).fill(0),  hoverinfo: 'none',
                  mode: 'lines', line:{color:'rgb(255,0,0)'}, name:'Mean', legendgroup:'2' };
  traceStdevM = { x: XP.slice(), y: new Array(NX).fill(0),  hoverinfo: 'none',
                  mode: 'lines', line:{color:'rgb(255,220,220)'}, name:'2 Standard deviations', legendgroup:'2' };
  traceStdevP = { x: XP.slice(), y: new Array(NX).fill(0),  hoverinfo: 'none',
                  mode: 'lines', line:{color:'rgb(255,220,220)'}, name:'2 Standard deviations', legendgroup:'2', showlegend:false };

  // Samples
  samp1 = { x: XP.slice(), y: new Array(NX).fill(0), hoverinfo:'none', mode:'lines',
            line:{color:'rgb(240,240,240)'}, name:'Samples', legendgroup:'3' };
  samp2 = { x: XP.slice(), y: new Array(NX).fill(0), hoverinfo:'none', mode:'lines',
            line:{color:'rgb(240,240,240)'}, name:'Samples', legendgroup:'3', showlegend:false };
  samp3 = { x: XP.slice(), y: new Array(NX).fill(0), hoverinfo:'none', mode:'lines',
            line:{color:'rgb(240,240,240)'}, name:'Samples', legendgroup:'3', showlegend:false };

  // Dataset points
  tracePoints = {
    x: [], y: [], mode:'markers', hoverinfo:'none',
    name:'Dataset', legendgroup:'1', marker:{color:'DarkSlateGrey'}
  };

  var data = [traceBackground, samp1, samp2, samp3, traceStdevM, traceStdevP, traceMean, tracePoints];

  var layout = {
    xaxis: { linecolor: 'black', mirror: 'ticks', range: [0, 10], fixedrange: true },
    yaxis: { linecolor: 'black', mirror: 'ticks', range: [-3, 3], fixedrange: true },
    margin: { b: 120 },
    legend: { x:0.5, y:-0.3, xanchor:'center' } // bottom (vertical, Plotly 1.x)
  };

  Plotly.newPlot(gpEl, data, layout, { displayModeBar:false });

  // Click-to-add points
  gpEl.on('plotly_click', function(ev){
    // consumable grid point from background heatmap at curveNumber 0
    for (var p=0; p<ev.points.length; p++){
      if (ev.points[p].curveNumber === 0){
        Plotly.extendTraces(gpEl, { x:[[ev.points[p].x]], y:[[ev.points[p].y]] }, [data.length-1]);
        updateVal(); // recompute posterior
        break;
      }
    }
  });

  updateVal(); // initial prior render
}

// Compute posterior traces efficiently
function getPosterior(logS, logT){
  var dataX = gpEl.data[gpEl.data.length-1].x; // dataset x
  var dataY = gpEl.data[gpEl.data.length-1].y; // dataset y
  var n = dataX.length;

  // Prior mean is zero; prior var at any x is σ_s^2
  var sigma2 = exp(2*logS);

  if (n === 0){
    // Prior only
    var stdev = Math.sqrt(sigma2);
    var ym  = new Array(NX).fill(0);
    var ysp = new Array(NX).fill( 2*stdev);
    var ysm = new Array(NX).fill(-2*stdev);

    // Samples from prior: y = L z where L = chol(K_xx + jitter I)
    var Kxx = buildKxx(logS, logT, XP);
    for (var i=0;i<NX;i++) Kxx[i][i] += jitter;
	symmetriseInPlace(Kxx);
    var Lp = chol(Kxx);

    function sampleFrom(L){
      var z = stdNormal(NX), s = new Array(NX);
      // y = L z
      for (var i=0;i<NX;i++){
        var sum = 0.0;
        for (var j=0;j<=i;j++) sum += L[i][j]*z[j];
        s[i] = sum;
      }
      return s;
    }

    return {
      mean: ym, m2p: ysp, m2m: ysm,
      s1: sampleFrom(Lp), s2: sampleFrom(Lp), s3: sampleFrom(Lp)
    };
  }

  // With data: build K(X,X)+σ_n^2 I and K(X*,X)
  var npost = logn.value(document.getElementById("PosteriorNoise").value); // noise std (linear)
  var K = buildKxx(logS, logT, dataX);
  for (var i=0;i<n;i++) K[i][i] += (jitter + npost*npost);

  symmetriseInPlace(K);
  var L = chol(K);                      // K = L L^T
  var alpha = solveKalphaEqualsY(L, dataY); // α = K^{-1} y

  var Ksx = buildKxstarX(logS, logT, XP, dataX); // (NX × n)

  // Posterior mean: μ* = K_*X α  (note Ksx * alpha)
  var mu = matVec(Ksx, alpha);

  // Posterior var diag: diag(Σ*) = σ_s^2 - diag( K_*X K^{-1} X*K_*^T )
  // Compute V = L \ K_*X^T = solveLowerMat(L, Ksx^T)
  // We need column-wise norms of V to subtract from σ_s^2
  // Build Ksx^T (n × NX) cheaply:
  var KsxT = (function(){
    var T = new Array(n);
    for (var r=0;r<n;r++){
      var row = new Array(NX);
      for (var c=0;c<NX;c++) row[c] = Ksx[c][r];
      T[r] = row;
    }
    return T;
  })();

  var V = solveLowerMat(L, KsxT);        // (n × NX)
  var v2 = colSqNorms(V);                // length NX
  var varStar = new Array(NX);
  for (var t=0;t<NX;t++) varStar[t] = Math.max(0, sigma2 - v2[t]);

  var ym  = mu;
  var ysp = new Array(NX);
  var ysm = new Array(NX);
  for (var t=0;t<NX;t++){
    var s = 2*Math.sqrt(varStar[t]);
    ysp[t] = ym[t] + s;
    ysm[t] = ym[t] - s;
  }

  // Optional: draw a few posterior samples
  // y* = μ* + L* z, with L* from chol(Σ*) — expensive if done fully.
  // A cheap visual proxy: add correlated component via V^T u (low-rank approx).
  function approxSample(){
    // draw u ~ N(0,I_n), then r = V^T u (length NX), scale so that var matches roughly
    var u = stdNormal(n);
    var r = matTvec(V, u); // V^T u
    // scale columns by something small to avoid overshoot; normalise to std ≈ sqrt(varStar)
    for (var t=0;t<NX;t++){
      var st = Math.sqrt(varStar[t]);
      r[t] = r[t] * (st / (Math.sqrt(v2[t] + 1e-12))); // stabilise
      r[t] = ym[t] + r[t];
    }
    return r;
  }

  return { mean: ym, m2p: ysp, m2m: ysm, s1: approxSample(), s2: approxSample(), s3: approxSample() };
}

// One fast refresh
function updateVal(){
  // Read sliders once
  var spost = Math.log(logs.value(document.getElementById("PosteriorSigma").value));
  var lpost = Math.log(logl.value(document.getElementById("PosteriorLengthscale").value));

  var post = getPosterior(spost, lpost);

  // Batch one restyle for each trace (avoid replacing trace objects)
  Plotly.restyle(gpEl, {
    y: [ post.s1         ],  // samp1 (index 1)
  }, [1]);
  Plotly.restyle(gpEl, { y: [ post.s2 ] }, [2]);
  Plotly.restyle(gpEl, { y: [ post.s3 ] }, [3]);
  Plotly.restyle(gpEl, { y: [ post.m2m ] }, [4]);
  Plotly.restyle(gpEl, { y: [ post.m2p ] }, [5]);
  Plotly.restyle(gpEl, { y: [ post.mean ] }, [6]);

  Plotly.redraw(gpEl);
}

// ----------- public hooks you already call ------------
function resetData(initSigma, initLen, initNoise){
  // Sync inputs
  $('#PosteriorSigmaVal').val(initSigma).trigger("keyup");
  $('#PosteriorLVal').val(initLen).trigger("keyup");
  $('#PosteriorNoiseVal').val(initNoise).trigger("keyup");

  // Clear points
  Plotly.restyle(gpEl, { x:[[]], y:[[]] }, [gpEl.data.length-1]);

  updateVal();
}

function optVals(){
  // keep your optimiser wiring; just call updateVal() after
  var spost = Math.log(logs.value(document.getElementById("PosteriorSigma").value));
  var lpost = Math.log(logl.value(document.getElementById("PosteriorLengthscale").value));
  var npost = Math.log(logn.value(document.getElementById("PosteriorNoise").value));
  var x0 = [spost, lpost, npost];

  var n=3, m=6, rhobeg=1.0, rhoend=1.0e-2, iprint=0, maxfun=150;
  var solution = FindMinimum(logLik_fast, n, m, x0, rhobeg, rhoend, iprint, maxfun);

  document.getElementById('PosteriorSigmaVal').value     = Math.exp(x0[0]);
  document.getElementById('PosteriorLVal').value         = Math.exp(x0[1]);
  document.getElementById('PosteriorNoiseVal').value     = Math.exp(x0[2]);
  document.getElementById('PosteriorSigma').value        = logs.position(Math.exp(x0[0]));
  document.getElementById('PosteriorLengthscale').value  = logl.position(Math.exp(x0[1]));
  document.getElementById('PosteriorNoise').value        = logn.position(Math.exp(x0[2]));
  updateVal();
}

// Fast log-likelihood: no inverses, reuse solves
function logLik_fast(n,m,X,con){
  var logS = X[0], logT = X[1], logN = X[2];
  // constraints (unchanged)
  con[0] = X[0] - Math.log(1e-2); con[1] = -X[0] + Math.log(1);
  con[2] = X[1] - Math.log(1e-1); con[3] = -X[1] + Math.log(10);
  con[4] = X[2] - Math.log(1e-18); con[5] = -X[2] + Math.log(1e-16);

  var dataX = gpEl.data[gpEl.data.length-1].x;
  var dataY = gpEl.data[gpEl.data.length-1].y;
  var npt = dataX.length;
  if (npt === 0) return 0; // nothing to fit

  var K = buildKxx(logS, logT, dataX);
  var sigmaN2 = Math.exp(2*logN);
  for (var i=0;i<npt;i++) K[i][i] += (jitter + sigmaN2);
  symmetriseInPlace(K);
  var L = chol(K);
  // α = K^{-1} y via solves
  var alpha = solveKalphaEqualsY(L, dataY);

  // log|K| = 2 * sum(log diag(L))
  var logdet = 0.0;
  for (var i=0;i<npt;i++) logdet += Math.log(L[i][i]);
  logdet *= 2;

  // y^T α
  var quad = 0.0;
  for (var i=0;i<npt;i++) quad += dataY[i]*alpha[i];

  // Negative log marginal likelihood (up to constant)
  var nll = 0.5*quad + 0.5*logdet + 0.5*npt*Math.log(2*Math.PI);
  return -nll; // your optimiser maximises
}

// Kick off once
buildPlot();

</script>
