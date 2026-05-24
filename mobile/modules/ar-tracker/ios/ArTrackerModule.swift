import ExpoModulesCore

public class ArTrackerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ArTracker")

    View(ArTrackerView.self) {
      // Props
      Prop("referenceImageBase64") { (view: ArTrackerView, value: String) in
        view.setReferenceImage(base64: value)
      }
      Prop("physicalWidth") { (view: ArTrackerView, value: Double) in
        view.physicalWidth = Float(value)
      }
      Prop("isActive") { (view: ArTrackerView, value: Bool) in
        if value { view.startTracking() } else { view.stopTracking() }
      }

      // Events
      Events("onAnchorFound", "onAnchorUpdated", "onAnchorLost")
    }
  }
}
