import ARKit
import ExpoModulesCore
import SceneKit
import UIKit

public class ArTrackerView: ExpoView, ARSCNViewDelegate {
  // MARK: - Expo events
  let onAnchorFound = EventDispatcher()
  let onAnchorUpdated = EventDispatcher()
  let onAnchorLost = EventDispatcher()

  // MARK: - State
  var physicalWidth: Float = 0.12
  private var referenceImage: UIImage?
  private var sceneView: ARSCNView!
  private var displayLink: CADisplayLink?
  private var trackedAnchor: ARImageAnchor?
  private var trackedNode: SCNNode?
  private var hasFirstFrame = false

  // MARK: - Init
  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    setupSceneView()
  }

  private func setupSceneView() {
    sceneView = ARSCNView(frame: .zero)
    sceneView.alpha = 0
    sceneView.delegate = self
    sceneView.autoenablesDefaultLighting = true
    sceneView.automaticallyUpdatesLighting = true
    addSubview(sceneView)
    sceneView.translatesAutoresizingMaskIntoConstraints = false
    NSLayoutConstraint.activate([
      sceneView.topAnchor.constraint(equalTo: topAnchor),
      sceneView.bottomAnchor.constraint(equalTo: bottomAnchor),
      sceneView.leadingAnchor.constraint(equalTo: leadingAnchor),
      sceneView.trailingAnchor.constraint(equalTo: trailingAnchor),
    ])
  }

  // MARK: - API
  func setReferenceImage(base64: String) {
    guard let data = Data(base64Encoded: base64, options: .ignoreUnknownCharacters),
          let img = UIImage(data: data) else { return }
    referenceImage = img
  }

  func startTracking() {
    guard let image = referenceImage,
          let cgImage = image.cgImage,
          ARImageTrackingConfiguration.isSupported
    else { return }

    let refImage = ARReferenceImage(cgImage, orientation: .up, physicalWidth: CGFloat(physicalWidth))
    refImage.name = "ring-tag"

    let config = ARImageTrackingConfiguration()
    config.trackingImages = [refImage]
    config.maximumNumberOfTrackedImages = 1
    sceneView.session.run(config, options: [.resetTracking, .removeExistingAnchors])

    displayLink = CADisplayLink(target: self, selector: #selector(reportAnchorPosition))
    displayLink?.add(to: .main, forMode: .common)
  }

  func stopTracking() {
    sceneView.session.pause()
    displayLink?.invalidate()
    displayLink = nil
    trackedAnchor = nil
    trackedNode = nil
    hasFirstFrame = false
    sceneView.alpha = 0
  }

  // MARK: - ARSCNViewDelegate
  public func renderer(_ renderer: SCNSceneRenderer, updateAtTime time: TimeInterval) {
    guard !hasFirstFrame else { return }
    hasFirstFrame = true
    DispatchQueue.main.async { [weak self] in
      UIView.animate(withDuration: 0.25) { self?.sceneView.alpha = 1 }
    }
  }

  public func renderer(_ renderer: SCNSceneRenderer, didAdd node: SCNNode, for anchor: ARAnchor) {
    guard let imageAnchor = anchor as? ARImageAnchor else { return }
    trackedAnchor = imageAnchor
    trackedNode = node
    DispatchQueue.main.async { [weak self] in
      guard let self else { return }
      self.onAnchorFound(["visible": true])
    }
  }

  public func renderer(_ renderer: SCNSceneRenderer, didRemove node: SCNNode, for anchor: ARAnchor) {
    guard anchor is ARImageAnchor else { return }
    trackedAnchor = nil
    trackedNode = nil
    DispatchQueue.main.async { [weak self] in
      self?.onAnchorLost([:])
    }
  }

  // MARK: - Position reporting
  @objc private func reportAnchorPosition() {
    guard let node = trackedNode,
          let pointOfView = sceneView.pointOfView else { return }

    // Project anchor's world position to screen coords
    let worldPos = node.worldPosition
    let screenPos = sceneView.projectPoint(worldPos)
    let bounds = sceneView.bounds

    // Normalise to 0–1 so JS can map to any screen size
    let nx = Double(CGFloat(screenPos.x) / bounds.width)
    let ny = Double(CGFloat(screenPos.y) / bounds.height)

    onAnchorUpdated(["normalX": nx, "normalY": ny, "visible": true])
  }
}
