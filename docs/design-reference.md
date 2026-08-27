# Pratix Bridge Tasarım Referansı

Sağlanan Pratix.io ana sayfa kaynağı; **zinc tabanlı nötr yüzeyler**, seçkin bir **mavi–indigo vurgu gradyanı** ve ince, düşük kontrastlı sınırlarla kurulmuş ölçülü bir mikro-SaaS estetiği kullanır. Pratix Bridge bu dili kopyalamak yerine doğrudan transfer ürününün ihtiyaçlarına uyarlayacaktır: çalışma alanı belirgin bir kart hiyerarşisine, işlem riski taşıyan durumlar ise açık durum renklerine sahip olacaktır.

| Tasarım unsuru | Referans dilinden çıkarım | Pratix Bridge uyarlaması |
|---|---|---|
| Renk | Zinc nötrleri ile mavi ve indigo vurgular | Açık ve koyu modda zinc ölçeği, güven hissi veren mavi ana aksiyonlar ve yeşil bağlı durum göstergeleri |
| Yüzey | İnce kenarlıklı beyaz kartlar, yumuşak gölgeler | Transfer çalışma alanı için katmanlı paneller; reklam alanları için ayrı, düşük öncelikli çevreleme |
| Tipografi | Sistem sans-serifi, sıkı başlık aralığı, küçük büyük harfli etiketler | Okunabilir sistem yazı tipi, sakin başlıklar, PIN ve bağlantı durumları için yarı monospaced değerler |
| Köşe ve boşluk | 12–24 px yuvarlatma, düzenli ölçek, ferah bloklar | Mobilde tek sütun, geniş ekranda kontrollü iki sütun; parmakla kullanım için en az 44 px etkileşim alanı |
| Hareket | Kısa renk/gölge geçişleri | Eşleştirme ve aktarım durumları için 160–240 ms, azaltılmış hareket tercihine saygılı geçişler |

Uygulamanın görsel odağı transfer alanıdır. PIN, QR, metin, dosya kuyruğu ve ilerleme göstergeleri ilk bakışta anlaşılır hâlde kalacak; reklam birimleri yalnızca içerik alanının dışında, `Advertisement` etiketiyle ve hiçbir bağlantı kontrolünü örtmeden gösterilecektir.
