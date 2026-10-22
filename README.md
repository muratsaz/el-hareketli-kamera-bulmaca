# Kare — El Hareketli Kamera Bulmacası

Referans: https://www.instagram.com/reel/DZ1YQ4HtCHy/

Videodaki siyah-beyaz kamera görüntüsü, iki elle fotoğraf çerçevesi oluşturma, sarı kenarlı 3×3 bulmaca ve parmaklarla parçaları değiştirme fikrinin çalışan tarayıcı uygulaması.

## Açma

Windows'ta **Baslat.cmd** dosyasına çift tıkla. Node.js kurulu olmalı (bu bilgisayarda mevcut). Tarayıcı otomatik açılır. Kurulum veya `npm install` gerekmez.

Elle başlatmak için `npm start`; ardından http://127.0.0.1:5178 adresini aç.

## Oynama

1. **Kamerayı aç** ve tarayıcıdaki kamera iznini ver.
2. İki elinin baş ve işaret parmaklarını açıp çerçeve oluştur. Bir saniye sabit tutunca fotoğraf çekilir. Alternatif: **Kareyi şimdi yakala** veya boşluk tuşu.
3. Bir parçanın üzerinde baş ve işaret parmaklarını birleştir. Diğer parçanın üstüne taşıyıp parmaklarını aç; parçalar yer değiştirir.
4. Dokuz parçayı tamamla. Sağdaki küçük fotoğraf hedef görüntüyü gösterir.
5. **Yeni kare yakala** tekrar elle çerçeve oluşturma moduna döner. **Parçaları karıştır** aynı fotoğrafla yeni oyun başlatır.

Kamerasız: **Önce örnekle dene** veya **Fotoğraf yükle**. Fareyle sürükleme, iki parçaya sırayla tıklama, telefonda dokunma ve klavyede yön tuşları + Enter desteklenir. Yeni fotoğraf yüklerken ortasından kare kırpılır.

El takibi için iyi aydınlatma kullan ve ellerini kadraj içinde tut. Kamera ve fotoğraflar sunucuya gönderilmez. Sekme kapatılınca kamera kapanır. El modeli, JavaScript ve WASM dosyaları proje içindedir. Yazı tipleri internet varsa Google Fonts'tan yüklenir; bağlantı yoksa sistem yazı tipleri kullanılır.

## Dosyalar

- `dist/index.html`, `style.css`, `app.js`: arayüz ve etkileşimler
- `dist/puzzle-core.js`: bulmaca ve koordinat hesapları
- `dist/hand-tracker.js`: MediaPipe el takibi
- `dist/vendor/`, `dist/models/`: yerel model, çalışma dosyaları ve lisans
- `server.mjs`, `launch.mjs`, `Baslat.cmd`: yerel başlatıcı
- `tests/`: anlamlı matematik ve oyun mantığı testleri

## Doğrulama

`npm test`: 7 test (karıştırmanın geçerliliği ve çözülebilirlik, parça değişimi, aynalama/kırpma, pinch ölçeği, çerçeve geometrisi ve süre).

Tarayıcıda örnek oyun başlatma, klavyeyle tamamlama, yeniden başlatma, fotoğraf yükleme, telefon genişliğinde görünüm ve yerel MediaPipe modelinin başlat/durdur/kapat akışı doğrulandı. Fiziksel kamera önünde gerçek el hareketleri bu kurulum sırasında sınanmadı.

Referans videonun görüntüsü veya müziği projeye kopyalanmadı; uygulama kendi kameranı ve yüklediğin fotoğrafı kullanır.
