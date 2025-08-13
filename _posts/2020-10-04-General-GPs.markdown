---
layout: post
title:  "Gaussian processes for regression"
date:   2020-10-04 13:52:00 +0700
categories: [Gaussian process, regression, Bayesian methods]
published: true
---

The potential of machine learning models is sometimes mesmerizing, especially when we look at some cutting edge [applications][ml-examples]{:target="_blank"}. But "the world ain’t all sunshine and rainbows", sometimes things go a bit wrong, and all of the sudden your virtual AI assistant just spontaneously decides to [throw a party at 2am][alexa-party]{:target="_blank"}, or to team with with your kid and [buy some toys and cookies][alexa-kid]{:target="_blank"}. That's reason enough to not blindly trust whatever your ML algorith predicts, but instead to try to get a grasp on how certain we can be about it. One way of quantifying this uncertainty is through probabilistic ML models, and Gaussian Processes (GPs) are one of the best candidates for the task.

## What is a Gaussian process?

What exactly is a Gaussian process? According to the [Wikipedia][wiki-gps]{:target="_blank"}, it's a "stochastic process in which every finite collection of random variables has a multivariate normal distribution", although a much, *much* better explanation of it is given the the amazing [book][rasmussen-gp]{:target="_blank"} by Rasmussen and Williams. In practice, it just means that we no longer have a deterministic system (when every $$x$$ point has a unique correspondent $$y$$ value) but rather a mean value $$\mu(x)$$ and an uncertainty range represented by a covariance function $$\text{cov}(x,x')$$. Just take a look at the figure below, should make things a bit clearer.

![Figure 01.](/assets/img/2020-10-04-General-GPs_01.png){: .center-image }
If $$f(x)=x^2$$ is your deerministic function, then a stochastic version of it can be made with $$\mu(x)=x^2$$ and $$\text{cov}(x,x')= 0.5^2I$$, where $$I$$ is the identity matrix.
{: style="font-size: 75%; text-align: center;"}

## How to make it useful

The whole point of machine learning is to create clever models and use available data to fine-tune them, so that their predictions are somewhat realistic. In the words of George Box: "All models are wrong, but some are useful". But how exactly can we do that with Gaussian Processes?

#### Create the model

We need to parametrize the multivariate normal distribution we talked about earlier. Sounds more difficult than it actually is: we can assume, with no loss of generality, that the mean value is zero, $$\mu(x)=0$$, and the covariance matrix is given by some kernel. There are lots of kernels in store to choose from, and you can even build your own, as Duvenaud showed in his [thesis][duvenaud-thesis]{:target="_blank"}. In here we'll just focus on a simple and really useful one: the Squared Exponential Kernel,

$$k(x,x') = \sigma^2_s \text{exp} \left( -\frac{1}{2} \frac{(x-x')^2}{\ell^2} \right),$$

which is vastly used in research. You can see from the formula that the kernel value depends not only on $$x$$ and $$x'$$, which are part of your data, but also on $$\sigma_s$$, an amplitude control, and on $$\ell$$, a lengthscale that represents, on average, how much of a change in $$x$$ is necessary to have a significant change in $$y$$. In addition to those, if your data has noise, you might want to include to your SE kernel a standard Gaussian noise kernel: $$k(x,x')=\sigma_n^2\delta(x,x')$$, with $$\delta$$ being the Kronecker delta function. This should only increase a bit the values in the diagonal of your covariance matrix, and has the effect of relaxing the predictions around your datapoints.

The choice of the kernel and the initial values for $$\sigma_s$$, $$\ell$$ and $$\sigma_n$$ defines your *prior* model: what you believe your predictions should look like, even before you have included any data in the model.

#### Including data: the likelihood

#### Hands-on testing

The implementation below, although simple, is pretty useful to showcase how powerful this model is. You can change the parameters and see what's their influence on the prior. Then include data just by clicking at the plot, again, change the parameters or optimize the model by minimizing the marginal likelihood, and check the results!

<iframe style="width:100%;height:770px;" frameBorder="0.05em" src="/gp.html" title="GP Implementation"></iframe>

[wiki-ml]: https://en.wikipedia.org/wiki/Machine_learning
[wiki-gps]: https://en.wikipedia.org/wiki/Gaussian_process
[ml-examples]: https://www.forbes.com/sites/bernardmarr/2018/04/30/27-incredible-examples-of-ai-and-machine-learning-in-practice/#53826aa17502
[alexa-kid]: https://www.cbsnews.com/news/6-year-old-brooke-neitzel-orders-dollhouse-cookies-with-amazon-echo-dot-alexa/
[alexa-party]: https://www.dailymail.co.uk/news/article-5062491/Police-called-Alexa-device-holds-1am-party.html
[rasmussen-gp]: http://www.gaussianprocess.org/gpml/
[duvenaud-thesis]: https://www.cs.toronto.edu/~duvenaud/thesis.pdf