import Capacitor
import Speech
import AVFoundation

/// Cortexx — Native speech recognition plugin.
///
/// Replaces the Web Speech API (which is not available in WKWebView on iOS).
/// Provides live transcription for voice memos and hands-free task dictation.
///
/// JS usage:
///   const { CortexxSpeech } = Capacitor.Plugins;
///   await CortexxSpeech.requestPermission();
///   await CortexxSpeech.start({ locale: 'en-GB' });
///   // listen for 'partialResult' and 'finalResult' events
///   await CortexxSpeech.stop();
@objc(CortexxSpeechPlugin)
public class CortexxSpeechPlugin: CAPPlugin {

    private var recognizer: SFSpeechRecognizer?
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private let audioEngine = AVAudioEngine()
    private var isRecording = false

    // MARK: - Permission

    @objc func requestPermission(_ call: CAPPluginCall) {
        SFSpeechRecognizer.requestAuthorization { status in
            AVAudioSession.sharedInstance().requestRecordPermission { granted in
                DispatchQueue.main.async {
                    let speechGranted = (status == .authorized)
                    call.resolve([
                        "speech": speechGranted,
                        "microphone": granted,
                        "granted": speechGranted && granted
                    ])
                }
            }
        }
    }

    @objc func checkPermission(_ call: CAPPluginCall) {
        let speechStatus = SFSpeechRecognizer.authorizationStatus()
        let micStatus = AVAudioSession.sharedInstance().recordPermission
        call.resolve([
            "speech": speechStatus == .authorized,
            "microphone": micStatus == .granted
        ])
    }

    // MARK: - Start / Stop

    @objc func start(_ call: CAPPluginCall) {
        let locale = call.getString("locale") ?? "en-GB"

        guard !isRecording else {
            call.reject("Already recording")
            return
        }

        recognizer = SFSpeechRecognizer(locale: Locale(identifier: locale))

        guard let recognizer = recognizer, recognizer.isAvailable else {
            call.reject("Speech recognizer not available for locale: \(locale)")
            return
        }

        do {
            try startRecognition(recognizer: recognizer)
            isRecording = true
            call.resolve(["started": true])
        } catch {
            call.reject("Failed to start: \(error.localizedDescription)")
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        stopRecognition()
        call.resolve(["stopped": true])
    }

    // MARK: - Internal

    private func startRecognition(recognizer: SFSpeechRecognizer) throws {
        recognitionTask?.cancel()
        recognitionTask = nil

        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.record, mode: .measurement, options: .duckOthers)
        try session.setActive(true, options: .notifyOthersOnDeactivation)

        recognitionRequest = SFSpeechAudioBufferRecognitionRequest()
        guard let recognitionRequest = recognitionRequest else { return }
        recognitionRequest.shouldReportPartialResults = true
        recognitionRequest.requiresOnDeviceRecognition = false

        let inputNode = audioEngine.inputNode
        let recordingFormat = inputNode.outputFormat(forBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { buffer, _ in
            self.recognitionRequest?.append(buffer)
        }

        audioEngine.prepare()
        try audioEngine.start()

        recognitionTask = recognizer.recognitionTask(with: recognitionRequest) { [weak self] result, error in
            guard let self = self else { return }

            if let result = result {
                let transcript = result.bestTranscription.formattedString
                if result.isFinal {
                    self.notifyListeners("finalResult", data: ["transcript": transcript])
                    self.stopRecognition()
                } else {
                    self.notifyListeners("partialResult", data: ["transcript": transcript])
                }
            }

            if let error = error {
                self.notifyListeners("error", data: ["message": error.localizedDescription])
                self.stopRecognition()
            }
        }
    }

    private func stopRecognition() {
        audioEngine.stop()
        audioEngine.inputNode.removeTap(onBus: 0)
        recognitionRequest?.endAudio()
        recognitionRequest = nil
        recognitionTask?.cancel()
        recognitionTask = nil
        isRecording = false

        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}
