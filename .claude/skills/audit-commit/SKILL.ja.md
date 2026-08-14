---
name: audit-commit
description: AIエージェントがGitコミットを実行する前に、提案されたコミットをセキュリティとコンプライアンス上の阻害要因について監査する。ユーザーがstage済み変更の安全性、適合性、コミット準備状況の確認、コミット前のセキュリティレビュー、またはAIエージェントによるコミットを求めたときに使用する。正確なstage差分とリポジトリ規約を確認し、関連する既存チェックを短時間で実行し、リスクを伴う変更だけ追加確認して、根拠付きのGOまたはNO-GOを返す。手動のpre-commit hookやリポジトリ全体のセキュリティ監査には使用しない。
---

# コミットを監査する

コミットの最終承認直前に、正確なstage済みスナップショットを監査する。
監査はread-onlyかつ既定では短時間に保ち、根拠の不足を明示する。

## 境界

- stage差分を提案されたコミットとして扱う。unstagedまたはuntrackedのファイルを暗黙に含めない。
- stage、unstage、編集、コミット、refsの変更を行わない。
- 既定ではツールのインストール、外部サービスへの接続、Git全履歴またはリポジトリ全体の走査を行わない。
- 発見した秘密情報や個人情報の値を出力しない。値を伏せ、種類と場所だけを示す。
- GO判定を、絶対的な安全性、法令遵守、規制上の認証の証明として扱わない。

正確な対象がstageされていない場合はNO-GOを報告し、先に対象スナップショットの確定を求める。
`commit-message`と併用する場合は、正確なstage操作の後、最終的なコミット承認の前にこの監査を実行する。
監査後にHEADまたはindexが変わった場合は結果を無効とし、監査を再実行する。
最終比較で確認した正確なHEADとstage済みスナップショットに対してのみ、結果を有効として扱う。

## Quick監査

1. 適用されるリポジトリ指示を読み、必須のコミット前チェックを特定する。
2. 次のコマンドで提案されたスナップショットを確認する。
   - `git status --short`
   - HEADを記録する`git rev-parse --verify HEAD`。HEADがまだ存在しない場合は`unborn`と記録する。
   - `git diff --cached --stat`
   - `git diff --cached --name-status`
   - 最終比較用にstage済みpath、mode、object IDを記録する`git diff --cached --raw --no-abbrev --no-renames`
   - 空白エラーと競合マーカーだけを確認し、セキュリティ上の問題は検査しない`git diff --cached --check`
   - `git diff --cached`
3. 新規バイナリ、シンボリックリンク、生成物、vendoredファイル、極端に大きい内容など、差分表示が不完全な場合だけstage済みファイルを直接確認する。
4. stage対象が説明された意図と一致し、無関係、偶発的、説明不能なファイルを含まないことを確認する。
5. stage済みスナップショットを使って、以下の該当する全分類をscreeningする。追加確認の条件がなければ、変更されていないcallerを調べたり追加チェックを実行したりしない。リポジトリ提供のスキャナーと、最小の関連する既存検証が利用可能で安全に実行できる場合は使用する。
6. HEADとraw stage差分のコマンドを再実行して手順2の正確な結果と比較し、`git status --short`と`git diff --cached --stat`も再確認する。HEADまたはstage済みスナップショットに差分がある場合はNO-GOを返す。

追加確認の条件がなければ、Quick監査で終了する。

## 監査分類

各分類を`Pass`、`Fail`、`Not checked`、`Not applicable`のいずれかで記録する。

- 分類が該当し、十分な根拠を確認できた場合は`Pass`を使う。
- blockerを観測した場合は`Fail`を使う。
- 分類が該当するが、必要な根拠を入手または確認できなかった場合は`Not checked`を使う。
- stage済みスナップショットが分類に影響しない場合は`Not applicable`を使う。

仮定上または未提示のポリシーやcheckから根拠不足を作らない。
リポジトリ指示、説明されたscope、stage済み変更のいずれからも適用要件を特定できない場合は`Not applicable`を使う。
次の判断に不足している根拠が必要な場合だけ、`Not checked`をblockingとして扱う。

- 秘密情報の疑いが事実かどうか
- 変更されたsecurity、data、permission動作が安全かどうか
- 追加された外部code、asset、artifactの入手元、license、provenance、integrityが許容可能かどうか
- リポジトリ必須checkが成功したかどうか
- リポジトリ指示、説明されたscope、stage済み変更から特定した、適用される具体的なリポジトリ・法令・組織要件を満たすかどうか

それ以外の`Not checked`はwarningとして扱い、確認結果がコミット可否を変更しない理由を説明する。

### 機密情報

- コード、設定、fixture、ログ、例、生成物に認証情報、トークン、秘密鍵、接続文字列、内部識別子、個人情報、機密内容、機密値が含まれていないか確認する。
- 新しいログ、エラー、telemetry、テスト出力が機密情報を開示しないか確認する。
- 有効な可能性がある秘密情報は`Fail`として扱う。検証や使用を行わない。

### セキュリティ動作

- 変更された信頼境界、入力検証、出力encoding、認証、認可、session処理、暗号、ファイル・process操作、network request、deserialize、error処理、loggingを確認する。
- 権限拡大、安全でない既定値、セキュリティ制御の回避、検証の無効化、fail-open動作を確認する。
- 追加確認時だけ、変更された高リスク経路についてsource、validation、authorization、sinkを確認できる範囲まで追跡する。

### サプライチェーンと来歴

- 追加・変更された依存関係、lockfile、registry、install script、CI action、download artifact、生成内容、vendored code、binaryを確認する。
- 正当な入手元、意図したversionまたはintegrityの根拠、リポジトリのlicense・attribution規則との互換性を確認する。
- licenseや来歴を推測しない。スナップショットが外部code、asset、artifactを追加または変更し、必要な根拠が得られない場合は`Not checked`とする。

### データとポリシーの適合性

- 個人、機密、規制対象、顧客データに関する収集、保存、転送、保持、削除、同意、accessの変更を確認する。
- リポジトリ指示、承認済みscope、必要な生成コピー、必須文書、禁止されたファイルや操作を確認する。
- stage済み変更に適用される法令または組織ポリシーがあり、必要な根拠を得られない場合は`Not checked`とし、結論を作らない。
- 未提示のポリシーが適用されると仮定しない。

### 検証の完全性

- 削除または弱体化されたtest、scanner、approval、branch protection、validation command、audit log、ignore ruleを確認する。
- 必須チェックがstage内容へ適用され、ファイルのskip、ignore、後生成、検査対象外だけを理由に成功していないことを確認する。
- コマンドを実行した事実と、提案されたコミットを検査できた根拠を区別する。
- 必須checkがproject fileまたはindexを変更する可能性がある場合は、監査対象スナップショットを確定する前の成功記録を必須とし、利用可能なread-onlyの根拠で期待される出力がそのスナップショットに含まれることを確認する。
- 必須実行の記録がない場合、または出力とスナップショットを対応付けられない場合はblockingの`Not checked`を報告し、ユーザーへ別途check実行を求める。必須の実行を同等な状態確認で置き換えない。

## 追加確認の条件

Quick監査ではstage済みスナップショットだけをscreeningする。
Quick監査で分類を解決できない場合、またはstage済みスナップショットが次に関するセキュリティ上重要な動作を導入または変更する場合だけ、変更されていないcaller、設定、test、data flowを含む対象を絞った追加確認を行う。

- 認証情報、秘密情報、identity、個人情報、規制対象データの処理、保存、転送
- 認証、認可、session、暗号、決済、破壊的なデータ操作、audit loggingの動作
- 外部入力の影響を受けるshell・process実行、ファイルaccess、network destination、permission境界、または実行可能なCI/CD・deploy・infrastructure・security設定
- 依存関係、lockfile、install hook、生成・vendored code、binary、license、外部asset
- 大規模、難読化、読解不能、一部だけ表示された変更
- Quick監査で見つかった不審なpattern、失敗したcheck、blockingの根拠不足

文書やexampleがリスク領域へ言及しているだけの場合や、変更されていない高リスクcodeが存在するだけの場合は追加確認しない。
追加確認では、影響を受ける経路だけを確認する。
リスクを解消できる最小の既存targeted checkを実行する。
解消にinstall、network access、project fileまたはindexを変更するcommand、広範囲のscan、入手できない組織上の根拠が必要な場合は、暗黙に開始しない。`Not checked`として正確な不足を説明し、その確認が必要な場合は別途許可を求める。

## 判定規則

次のすべてを満たす場合だけ`GO`を返す。

- 正確なstage対象が説明された意図と一致する。
- `Fail`の分類がない。
- blockingの`Not checked`が残っていない。
- 該当するリポジトリ必須チェックが提案されたスナップショットに対して成功している。
- 最終監査比較で正確なHEADとraw stage差分のfingerprintが一致する。

blocker、必須チェックの失敗、scope不一致、HEADまたはstage済みスナップショットの変更、秘密情報の疑い、blockingの`Not checked`がある場合は`NO-GO`を返す。
非blockingの`Not checked`はwarningとして扱い、判定を変更しない理由を示したうえで`GO`に併記してよい。
コミットしない。最終的なコミット承認は、ユーザーによる別の判断として残す。

## 出力

次を簡潔に報告する。

1. `Decision: GO`または`Decision: NO-GO`
2. stage対象ファイルと説明された意図
3. `Blocker`、`Warning`の順に並べた指摘と各項目の監査status。非blockingの`Not checked`は`Warning`に含める。値を伏せた根拠、可能な場合はファイルと行、最小の修正を含める。
4. 確認したコマンドとリポジトリ規則。失敗および省略したチェックを含める。
5. 最終監査確認時に、最初と最後の正確なHEADとraw stage差分のfingerprintが一致したか、および結果がその確認済みスナップショットだけに適用されること。
6. コミットを作成しておらず、別途コミット承認が必要であること。

指摘がない場合は、報告を水増しせず、その旨を直接記載する。
