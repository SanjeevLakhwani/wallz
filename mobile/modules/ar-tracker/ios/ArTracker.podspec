require 'json'
pkg = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'ArTracker'
  s.version        = pkg['version']
  s.summary        = pkg['description']
  s.homepage       = 'https://github.com/wallz'
  s.license        = 'MIT'
  s.authors        = { 'Wallz' => 'noreply@wallz.app' }
  s.platforms      = { :ios => '16.0' }
  s.source         = { :path => '.' }
  s.source_files   = '*.swift'
  s.dependency 'ExpoModulesCore'
  s.frameworks     = 'ARKit', 'SceneKit'
end
