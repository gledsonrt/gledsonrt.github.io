# frozen_string_literal: true

Gem::Specification.new do |spec|
  spec.name          = "tondo"
  spec.version       = "0.01"
  spec.authors       = ["Gledson"]
  spec.email         = ["gledsonrt@gmail.com"]

  spec.summary       = "A portfolio style jekyll theme modified from the original"
  spec.homepage      = "https://github.com/gledsonrt"
  spec.license       = "MIT"

  spec.files         = `git ls-files -z`.split("\x0").select { |f| f.match(%r!^(assets|_layouts|_includes|_sass|LICENSE|README|404.html|sitemap.xml|search.json)!i) }

  spec.add_runtime_dependency "jekyll", ">= 3.7.3"
  spec.add_runtime_dependency "jekyll-seo-tag", ">= 2.1.0"

  spec.add_development_dependency "bundler", "> 1.16"
  spec.add_development_dependency "rake", "~> 12.0"
end
