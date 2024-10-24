---
title: "WhisperのAPIを作る（ファイル保存なしで文字起こしする方法）"
date: "2024-10-24"
tags: ["Python", "Whisper", "FastAPI"]
---

前回 [ファイル保存なしでWhisper APIにLINE Messaging APIから音声を渡す](/posts/2024/10/whisper-from-line-messaging-api) という記事を書きましたが、OpenAI の API を使うと決める前はラズパイ上で Whisper を動かすことを企んでいました。今回はその記事になります。今回もファイル保存せずにやります。

作った API を Raspberry Pi 5 で動かしてみたのですが、数秒の medium モデルで音声を文字起こしするのに1〜2分はかかるので使い物にならなくてやめました。

## 環境

* Python 3.9.20
* openai-whisper 20240930
* FastAPI 0.115.2
* ffmpeg-python 0.2.0
* numpy 2.0.2
* Rye 0.31.0

M2 MacBook Air で動作確認しています。

## 成果物

https://github.com/SogoKato/whisper-api

上記リンク先の README の通りにやれば、Whisper で音声認識した結果を返してくれる API が立ち上がります。

```
curl -w "\ntime_total: %{time_total}\n" -X POST http://localhost:8000/transcription -F "file=@$(pwd)/outputs/example.wav;type=audio/wav"
```

結果 [^1]

```
{"text":"そもそも大将軍の私に直に教わろうなんて虫が良すぎますよコココココ","lang":"ja"}
time_total: 33.191537
```

[^1]: https://youtu.be/J3DMnnhSYcw の一部を録音しました。

## ちょこっと解説

下記のようにリクエストモデルを定義しました。`UploadFile` を使用することで簡単にファイルのアップロードを受け取ることができます。

```python
class TranscriptionRequest(BaseModel):
    file: UploadFile
    model: str = config.default_model
```

`content` には bytes 型でアップロードされたファイルが格納されています。

```python
@app.post("/transcription")
async def transcribe(req: Annotated[TranscriptionRequest, Form()]):
    content = await req.file.read()
```

上記の bytes 型の音声データを一時ファイルを保存せず、インメモリで Whisper に渡す方法については GitHub discussions に [Using ndarray as input to transcribe method](https://github.com/openai/whisper/discussions/380) という Q&A があり、これを参考にしました。

openai-whisper 本家の [`load_audio`](https://github.com/openai/whisper/blob/25639fc17ddc013d56c594bfbf7644f2185fad84/whisper/audio.py#L25-L62) 関数では ffmpeg コマンドを直接呼び出していますが、これをやらずに python-ffmpeg ライブラリを介して入力を渡してサブプロセスを呼び出しています。

```python
def load_audio(file: bytes, sr: int = 16000):
    """
    Open an audio file and read as mono waveform, resampling as necessary

    Parameters
    ----------
    file: (str, bytes)
        The audio file to open or bytes of audio file

    sr: int
        The sample rate to resample the audio if necessary

    Returns
    -------
    A NumPy array containing the audio waveform, in float32 dtype.
    """

    inp = file
    file = "pipe:"

    try:
        # This launches a subprocess to decode audio while down-mixing and resampling as necessary.
        # Requires the ffmpeg CLI and `ffmpeg-python` package to be installed.
        out, _ = (
            ffmpeg.input(file, threads=0)
            .output("-", format="s16le", acodec="pcm_s16le", ac=1, ar=sr)
            .run(cmd="ffmpeg", capture_stdout=True, capture_stderr=True, input=inp)
        )
    except ffmpeg.Error as e:
        raise RuntimeError(f"Failed to load audio: {e.stderr.decode()}") from e

    return np.frombuffer(out, np.int16).flatten().astype(np.float32) / 32768.0
```

渡しているオプションは本家の `load_audio` 関数と同じです。ちなみに `-` も `pipe:` も標準入力・標準出力を指しています。

その他の処理は [openai/whisper の README](https://github.com/openai/whisper/blob/main/README.md) のサンプルと同じですが、以下の部分は turbo モデルを使用した際にエラーになったので [Error in the "large-v3" model](https://github.com/openai/whisper/discussions/1778) の Q&A を参考に修正しています。

```diff
# make log-Mel spectrogram and move to the same device as the model
-mel = whisper.log_mel_spectrogram(audio).to(model.device)
+mel = whisper.log_mel_spectrogram(audio, model.dims.n_mels).to(model.device)
```

発生したエラー

```
RuntimeError: Given groups=1, weight of size [1280, 128, 3], expected input[1, 80, 3000] to have 128 channels, but got 80 channels instead
```

## 参考文献

* [openai/whisper: Robust Speech Recognition via Large-Scale Weak Supervision](https://github.com/openai/whisper)
* [ffmpeg Documentation](https://ffmpeg.org/ffmpeg-all.html)
* [Feeding data to `stdin` - python-ffmpeg](https://python-ffmpeg.readthedocs.io/en/latest/examples/feeding-data-to-stdin/)
* [Using ndarray as input to transcribe method · openai/whisper · Discussion #380](https://github.com/openai/whisper/discussions/380)
* [how to directly transcribe an in memory audio file ?? · openai/whisper · Discussion #908](https://github.com/openai/whisper/discussions/908)
* [Form Models - FastAPI](https://fastapi.tiangolo.com/ja/tutorial/request-form-models/)
* [UploadFile class - FastAPI](https://fastapi.tiangolo.com/reference/uploadfile/)
* [Error in the "large-v3" model · openai/whisper · Discussion #1778](https://github.com/openai/whisper/discussions/1778)
