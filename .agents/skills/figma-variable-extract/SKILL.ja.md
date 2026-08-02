# Figma Variable Extract 日本語参考訳

> このファイルは、人間がスキルの内容を確認するための参考訳です。
> Codexがスキルを実行するときの正本は `SKILL.md` です。
> 内容に差異がある場合は `SKILL.md` を優先してください。
> 翻訳元SHA-256：`8a664133c33532bcfb55a58a0a43cb285562c9ed7d55c09a793de0e9823d077c`

MCPの返却結果をそのまま抽出し、ファイル内のすべてのVariable参照と推移的なAlias依存先を解決できたことを証明してからCSSを生成する。
raw JSONは一時的な証拠として扱い、検証を通すために編集しない。
検証済みCSSの生成に成功した後だけ削除する。

## 機密性のある実行元情報を保護する

指定された対象URLとfileKey、Figmaのファイル名とページ名、組織名とLibrary名、Collection名、すべてのFigmaファイル、ページ、Variable、CollectionのIDまたはKeyを、機密性のある実行元情報として扱う。

`whoami`などのIdentity確認または接続確認が返す内容全体を機密情報として扱う。メールアドレス、ハンドル、ユーザー名、アカウントプラン、SeatまたはLicense種別、組織所属、rawレスポンスを繰り返さない。確認に成功した場合は、`Figma公式Remote MCPへの接続を確認した。`とだけ報告する。失敗した場合は、rawレスポンスを転記せず、接続を利用できないことだけを報告する。

機密性のある実行元情報は、返却結果をそのまま保存したraw証跡、一時的な準備済みコード、トークン契約上必要な場合の生成済みプロジェクトCSS、ローカル診断だけに保持する。再利用スキルのソース、コミットメッセージ、GitHub IssueまたはPull Request、リリースノート、公開可能なレポート、外部向け要約、通常のAssistant説明へ転記しない。ローカル診断以外では、ページとCollectionを実行時の数値indexで参照する。

依頼者向け要約では、指定された対象を使用したことだけを確認し、URL、fileKey、ファイル名、ページ名、組織名、Library名、Collection名、ID、Keyを繰り返さない。代わりに、件数、選択範囲、フェーズ状態、警告コードと件数、成果物の状態、安全なパスを報告する。外部公開を明示的に求められた場合は、先に内容を匿名化してスキャンする。ローカルの失敗診断には修復に必要な機密値を保持してよいが、公開成果物や外部向け応答へそのままコピーしない。

## 生成範囲を明示的に選択してもらう

Figma DesignファイルのURLを必須とする。
URLが指定されていなければ質問する。
URLからfileKeyを解析し、機密性のある実行元証跡として保持する。

CSSの公開範囲は、次の二つの使用範囲だけとする。

- **ローカル使用限定**：ファイルの使用Variable集合に含まれるローカルVariableだけをエクスポートし、`--local-only`でCSSを生成する。すべてのリモートLibrary Variableを除外する。対象のローカルVariableが除外したLibrary Variableを参照している場合は、Alias検証に失敗する可能性がある。
- **完全使用**：実際に使用されているVariableと推移的なAlias依存先を、ローカルとリモートの区別なくエクスポートし、`--local-only`を付けずにCSSを生成する。

有効化済みLibrary Collectionは診断情報であり、抽出範囲ではない。
Collectionが有効という理由だけでLibrary Variableをエクスポートしない。
どちらの範囲でもFigmaファイルを変更しない。
Libraryエクスポートは使用中VariableをIDで解決し、`importVariableByKeyAsync`を呼び出さない。

CSSを検証または生成するすべての処理に、次の**ハードゲート**を適用する。

1. 前提条件を確認してから、読み取り専用のInventory取得だけを実行する。
2. 対象の識別情報を繰り返さず、指定された対象でInventoryを取得したことだけを確認する。直接Binding数、Alias依存数、使用中のローカルVariable数とLibrary Variable数、ローカル定義総数、有効化済みだが未使用のLibrary Collection数、両方の生成範囲で予測したCSS名衝突数、警告コードと件数、Inventoryエラー件数を報告する。名前、ID、Key、URL、警告Messageは報告しない。
3. `local-only`または`complete`を選ぶよう依頼者へ質問する。`local-only`はリモート依存先を除外するためAlias検証に失敗する可能性があると説明する。`complete`は使用Variable集合だけを含み、有効化済みだが未使用のLibrary Variableをインポートしないと説明する。
4. 直接的で曖昧さのない選択を待つ。待機中は、どちらのエクスポートScriptも実行せず、検証、CSS生成、保持済み成果物の削除または置換、生成範囲の推測を行わない。

既定値を設けない。
最初の依頼文が生成範囲を指定しているように見える場合でも、Inventoryの要約を提示した後に選択を得る。
沈黙、以前の実行、既存JSON、設定、編集権限、空のLibrary一覧、別ファイルで選んだ範囲を、今回の生成範囲の選択とみなさない。
回答が曖昧なら再度質問する。

次のモードは、それだけではCSSの生成範囲を選択したことにならない。

- **抽出のみ**：明示された使用範囲のInventory取得またはエクスポートだけを実行する。CSSが最新であるとは報告しない。
- **再開**：失敗した実行後に残ったInventoryとBatchを調べ、不足または不正なBatchだけを再取得する。ファイル名だけを根拠に正常と判断しない。

抽出のみまたは再開からCSSの検証や生成へ進む場合は、先にハードゲートを通過する。
有効化定義の全件や任意に選んだ一部を、完全使用と表現しない。

## 前提条件を確認する

1. この`SKILL.md`を基準にスキルディレクトリを解決し、書き込み可能な対象プロジェクトの作業ディレクトリを必須とする。出力先ツリーを事前に作る必要はない。
2. `PATH`上で`node`を利用できるか確認する。利用できなければ停止し、Node.js 22以上が必要であると報告する。依頼者の承認なしにNode.jsをインストールしたり、リモートのインストールScriptを実行したりしない。
3. `node <skill-directory>/scripts/generate-design-tokens.mjs --check-runtime`を実行する。成功した場合だけ続行する。
4. Node.jsが22未満の場合は、対象プロジェクトのランタイム宣言とインストール済みバージョンマネージャーを確認する。プロジェクトが管理している互換ランタイムを優先し、承認なしにランタイム方針の上書きやソフトウェアのインストールを行わない。
5. `node <skill-directory>/scripts/prepare-use-figma-code.mjs --phase self-check`を実行する。正本の抽出Script、正確なPlaceholder、同梱設定、読み取り専用API契約を検証する。正常な実行では同梱ScriptのソースをモデルのContextへ読み込まない。自己検査、準備、検証、生成のエラーが示したファイルだけを読む。
6. 通常は同梱設定を使う。プロジェクト固有の意味的なルールが必要な場合は、再利用するスキルの外へ設定をコピーし、依頼者の承認を得てコピーを編集し、`--config`で指定する。同梱設定を暗黙に変更しない。
7. ツールの返却形式に合わせるためだけに、同梱された抽出Scriptを変更しない。
8. 接続済みの**Figma公式Remote MCP**を特定し、現在のツールスキーマを確認する。Figmaツールが公開されていなければツール探索を使用する。クライアント固有のMCPサーバープレフィックスをハードコードしない。すべての接続確認とその説明に、Identity確認結果の機密ルールを適用する。
9. 最初の`use_figma`呼び出し前に、そのプロバイダーの仕組みを使って最新の公式`figma-use`スキルを最後まで読む。接続またはSchemaが変化した場合だけ再読込する。確認した`use_figma` Schemaがスキル識別子を要求する場合は、すべての呼び出しへ渡す。
10. `use_figma`または`figma-use`を利用できなければ停止し、接続が不足していることを報告する。`get_variable_defs`、ブラウザスクレイピング、推測したREST API、捏造データへフォールバックしない。
11. この処理では`get_variable_defs`を使用しない。このツールは、必要なraw形式、チェックサム、ページ分割を備えた使用Variable契約を返さない。
12. 同梱Scriptのコードは、トップレベルの`await`と`return`を使って送信する。async IIFEで囲まず、`figma.closePlugin()`を呼び出さない。

同梱された抽出Scriptはすべて読み取り専用である。
Figma公式Remote MCPの実行環境では利用できないため、`loadAllPagesAsync`を呼び出さない。
最初にページ一覧を取得し、1回の`use_figma`呼び出しにつき1ページだけを走査する。
ページ走査Scriptは、1回の`use_figma`呼び出しで`setCurrentPageAsync`を最大1回だけ呼び出す。
対応しないノード型で例外を返す可能性があるプロパティは安全に読み取り、対象ページのノードが参照するStyleを`getStyleByIdAsync`で解決し、そのStyleのBindingを調べる。
後続Scriptは、`getVariableByIdAsync`でVariableを解決し、`getVariableCollectionByIdAsync`でCollectionを解決し、`VARIABLE_ALIAS`の値を推移的にたどる。
VariableのBinding、Variableのインポート、ノードの編集は行わない。

## 一時成果物を管理する

設定された`inputDirectory`へ、一時的な`raw/`ツリーを直接作る。
既定の保存先は`src/design-tokens/raw`とする。

```text
raw/
├── page-list.json
├── pages/page-<zero-padded-index>.json
├── inventory.json
├── plans/batch-<start-index>.json  # 完全使用またはローカルのFallbackだけ
├── local/batch-<start-index>.json
└── libraries/collection-<zero-padded-index>/batch-<start-index>.json  # 完全使用のみ
```

このディレクトリ内のすべてのJSONを、1回の抽出に属する一時成果物として扱う。
新規実行前に既存JSONを確認する。
同じ対象ファイル、使用集合チェックサム、選択範囲に属する場合だけ再開に使用する。
別の実行結果である場合は新しい結果と混在させず、失敗時の証拠を削除または置換する前に依頼者の承認を得る。

ページ一覧、すべてのページ走査、Inventory、エクスポートを、一つの安定したFigmaリビジョンに対して実行する。
ページ識別子の変更、ページ消失、direct ID Manifestの変化、Inventoryと異なるエクスポート使用集合チェックサムを検出した場合は、証跡を保持してページ一覧からやり直す。
実行環境はリビジョンをロックできないため、長時間のfan-out中にファイルが変更される可能性がある場合は同時編集リスクを報告する。

ジェネレーターは、最終CSSを書き込み、再読込による一致確認に成功した後だけ、認識した入力JSONと一時report JSONを削除する。
その後、設定された入力ディレクトリまで空のディレクトリを削除する。
非JSONファイルなどの保持対象が残るディレクトリは削除しない。
`--validate-only`、`--dry-run`、失敗した生成ではJSONとディレクトリを残し、原因調査と再開に利用できる状態を保つ。

`use_figma`が返したオブジェクトは、要約、省略、値の変更、レコードの結合、エラーの手編集をせずに保存する。
検証するときだけ、返却オブジェクトのコピーをパースする。
途中で切れたレスポンス、JSONではないレスポンス、ツールエラーのレスポンスは公開しない。
レスポンス上限を回避するために、`figma.clientStorage`、呼び出しをまたぐChunk再構成、その他の状態を持つ回避策を使用しない。

`mktemp -d`で対象プロジェクト外に一つの一時コードディレクトリを作る。
すべてのPlaceholder置換に`scripts/prepare-use-figma-code.mjs`を使用し、注入済みMCPコードを手作業で作成または修正しない。
補助Scriptは保存済みチェックサムを検証し、各MCP結果の正確な絶対`artifactPath`を含む、機密情報を含まない実行メタデータだけを標準出力へ返す。
返却された`artifactPath`だけを保存先として使用し、相対パスへ短縮したり、手作業で組み立てたり、別のパスへ置き換えたりしない。
生成コードは実行元情報を含むためプロジェクト外に置き、成功後に準備済みコードの一時ディレクトリを削除する。

各`use_figma`結果を受信したら、説明、チェックサム調査、次の呼び出しより先に、返却結果をそのまま保存する。
ページやBatchごとのTaskを作らず、ワークフロー全体で一つのチェックリストを使用する。
開始時刻、各フェーズ境界、範囲選択待ち時間、`use_figma`呼び出し数、再試行、終了時刻を記録する。

## Variableを抽出する

### 1. ページ一覧を取得する

正本Scriptを編集せず、ページ一覧コードを準備する。

```bash
node <skill-directory>/scripts/prepare-use-figma-code.mjs --phase page-list --file-key "<fileKey>" --output "<prepared-code-directory>/page-list.js"
```

準備済みコードを一度だけ読み、対象URLで実行し、返却されたオブジェクトを補助Scriptが報告した正確な絶対`artifactPath`へ直ちにそのまま保存する。

payloadチェックサム、fileKey、ファイル名、ページ数、ページ順、一意なページID、一意なindexを確認する。
返却結果が途中で切れた場合や矛盾する場合は、その結果を保持して停止する。
省略されたページを推測しない。

### 2. すべてのページを走査する

最大5ページ分のコードを一度に準備する。

```bash
node <skill-directory>/scripts/prepare-use-figma-code.mjs --phase page-wave --raw-dir src/design-tokens/raw --start-index <page-index> --count <1-to-5> --output-dir "<prepared-code-directory>/pages"
```

返された準備済みファイルを読み、1回の`use_figma`呼び出しで1ページだけを実行し、各返却結果を対応するページ要素が報告した正確な絶対`artifactPath`へ直ちにそのまま保存する。

準備済みWaveを読んだ直後のAssistantメッセージには、報告された件数と同数の`use_figma` Tool Callだけを含め、説明や無関係なTool Callを含めない。
結果を待つ前にすべての呼び出しを発行し、クライアントが並列実行できるようにする。
最初は同時実行数を5以下とし、TimeoutまたはRate Limitを受けたら並列数を減らし、失敗したページだけを再試行する。
残りの呼び出しをクライアントが受理する前に最初の結果が返った場合は、そのWaveをクライアント直列化として記録する。
1回の呼び出しに複数ページをまとめない。
走査Scriptは対象ページに対して`setCurrentPageAsync`をちょうど1回だけ呼び出し、`loadAllPagesAsync`を呼び出してはならない。

各結果について、payloadチェックサム、fileKey、ファイル名、ページ識別子、件数、並び替え済みで一意なdirect Variable ID、並び替え済みで一意な明示Mode Collection ID、空の`errors`を確認する。
走査Scriptが捕捉したプロパティ読取例外は、該当データがないものとして扱う。
Style解決エラーなどの走査エラーが1件でもあればページ網羅性は未証明であるため、すべてのページ証跡を保持して停止する。

全ページに成功した後、補助Scriptに保存したraw JSONを変更させず、次の短い値を導出させる。

- `pageManifest`：ページ順に並べた、`index`、`id`、`name`、`scanChecksum`、完全な`counts`オブジェクトを持つ要素
- `directVariableIds`：全ページの`directVariableIds`を重複除去して並び替えた和集合
- `explicitVariableModeCollectionIds`：全ページの対応する一覧を重複除去して並び替えた和集合

補助Scriptは、これらを導出する前にすべてのrawチェックサムを検証する。
置換後のInventoryコードがプロバイダーの現在のコードサイズ上限を超える場合は、証跡やIDを切り詰めず、停止して制限を報告する。

### 3. ファイル内の使用状況をInventoryへ記録する

保存済みページ証跡からInventoryコードを準備する。

```bash
node <skill-directory>/scripts/prepare-use-figma-code.mjs --phase inventory --raw-dir src/design-tokens/raw --output "<prepared-code-directory>/inventory.js"
```

準備済みコードを一度だけ読み、同じ対象URLで実行し、返却されたオブジェクトを補助Scriptが報告した正確な絶対`artifactPath`へ直ちにそのまま保存する。
補助Scriptは、検証済みページManifest、direct ID、明示Mode Collection、変更していない命名設定、`maxInventoryPayloadBytes`を注入する。

Inventoryは、注入されたManifestからページ網羅性を証明し、注入されたdirect IDを解決する。
その後、`valuesByMode`内のすべての`VARIABLE_ALIAS`を、参照集合が閉じるまでたどる。
有効化済みLibrary定義や手作業で選んだ部分集合を注入しない。

次を確認する。

- `kind`が`figma-variable-inventory`であり、`schemaVersion`が`2`である。
- `fileKey`が対象URLと一致する。
- `integrity.algorithm`が`fnv1a32-utf16`である。
- `usage.pageCount`、`usage.scannedPageCount`、`usage.pageListChecksum`、`usage.pageScansChecksum`が、保存したページ証跡と完全に一致する。
- `usage.directVariableCount`と`usage.directVariableIdsChecksum`が、Inventory内に完全なID一覧を重複させず、導出した和集合と完全に一致する。
- `usage.errors`が空であり、直接参照数と解決済み件数に矛盾がなく、使用集合チェックサムが存在する。
- `local.variableCount`が使用中ローカルVariable数を示し、`local.definedVariableCount`が一意なローカル定義総数を示す。
- `local.variableIdsChecksum`と各`libraryCollections[].variableIdsChecksum`が、それぞれのExport計画を確定できる。
- `local.variableIds`が存在する場合は、件数とチェックサムが一致する完全で順序付きのローカル計画であり、local-only高速経路を利用できる。存在しない場合はInventoryのPayload上限に収まらなかったため、Export-planのFallbackが必要である。
- `libraryCollections`が使用中のリモートCollectionとAlias依存先だけを含む。
- `enabledLibraryCollections`が診断専用であり、有効化済みだが未使用のCollectionを識別できる。
- `namingPreflight.localOnly`と`namingPreflight.complete`が、選択した命名設定を使い、同名Collectionという推測ではなく実際のCSS名衝突を報告する。
- 使用中の各CollectionでKeyが一意であり、件数が0以上の整数で、使用集合チェックサムが存在する。

シリアライズしたInventoryが`maxInventoryPayloadBytes`以内であることを必須とする。
`GENERIC_FILE_NAME`、`NO_LOCAL_VARIABLE_DEFINITIONS`、`NO_VARIABLE_BINDINGS`、`ENABLED_LIBRARY_UNUSED`、`USED_LIBRARY_NOT_ENABLED`、`CSS_NAME_COLLISION_PREDICTED`をハードゲートで明示する警告として扱う。
有効化済みだが未使用のCollectionをエクスポート対象へ変えない。
予測した衝突を避けるために生成範囲を自動選択しない。
`usage.errors`が1件以上ならInventoryを保持して停止する。
使用Variable集合の完全性を証明できないためである。
この確認後にハードゲートを適用し、依頼者による生成範囲の選択を待つ。

### 4. 必要な場合だけサイズ制限付きExport計画を確定する

`complete`では必ずサイズ制限付きExport計画を準備する。
`local-only`では、有効な`inventory.local.variableIds`が存在する場合はこのフェーズを省略する。
存在しない場合は、同じフェーズを`--scope local-only`で実行し、サイズ安全なFallbackとする。

必要な各Export計画ページを準備する。

```bash
node <skill-directory>/scripts/prepare-use-figma-code.mjs --phase plan --raw-dir src/design-tokens/raw --scope <local-only-or-complete> --start-index <index> --output "<prepared-code-directory>/plan-<index>.js"
```

index `0`から開始し、準備済みコードを一度だけ読み、実行し、各返却結果を補助Scriptが報告した正確な絶対`artifactPath`へ直ちにそのまま保存する。
`hasMore`が`false`になるまで`pagination.nextStartIndex`から続行する。
補助Scriptは、検証済みdirect ID和集合、短いInventory要約、選択範囲、`maxBatchSize`、`maxPlanPayloadBytes`を注入する。

計画呼び出しは完全なAlias閉包を再解決し、Inventoryの件数、identityチェックサム、Collectionチェックサムがすべて変化していないことを必須とする。
ローカルFallbackではローカルIDだけを返し、`complete`ではローカルと使用中Libraryの範囲に分けた完全使用閉包を返す。
各レスポンスは個別にサイズ上限を守る。
異なるManifestのChunkを結合しない。
連続したページ分割、同一の取得元とGroup Manifest、Batchチェックサム、完全な計画チェックサム、一意なID、Inventoryとの完全一致を確認する。
閉包が変化した場合は計画を破棄し、Inventoryからやり直す。

### 5. 使用中のローカルVariableをエクスポートする

ハードゲートで依頼者が`local-only`または`complete`を選択した後だけ、この節を実行する。
どちらの範囲でもローカルエクスポートが必要になる。

`config.extraction.maxBatchSize`と`config.extraction.maxPayloadBytes`を使う。
Inventoryの使用中ローカルVariable数が0件でも、少なくとも1回は実行する。
補助Scriptは最初にInventoryへ埋め込まれた計画を読み、存在しない場合だけ検証済みFallback Export計画を必須とする。
すべてのローカルBatchは、計画された対象IDだけを取得し、閉包を再計算しない。

各呼び出しで、次の手順を実行する。

1. `node <skill-directory>/scripts/prepare-use-figma-code.mjs --phase local --raw-dir src/design-tokens/raw --start-index <index> --output "<prepared-code-directory>/local-<index>.js"`を実行する。安全なMetadataが高速経路では`planSource: "inventory"`、Fallbackでは`planSource: "export-plan"`を報告することを必須とする。
2. 準備済みコードを一度だけ読み、`use_figma`で実行する。
3. 返却結果を補助Scriptが報告した正確な絶対`artifactPath`へ直ちにそのまま保存する。
4. `hasMore`が`false`になるまで、`pagination.nextStartIndex`から続行する。

補助Scriptは、ローカルExportに必ず`inventory.local.usageChecksum`を選ぶ。
完全使用チェックサムへ置き換えたり、Scratchのコード生成Scriptを作ったりしない。

各Batchで、スキーマ、fileKey、ファイル名、payloadチェックサム、Export計画チェックサム、使用集合チェックサム、Batch identityチェックサム、Collection識別子、ページ分割の計算、設定した抽出上限、成功件数と失敗件数、Variableの所属を確認する。
ローカルBatchを受け入れる前に、検証済みExport計画とInventoryの一致を必須とする。
ローカル使用集合チェックサムは`inventory.local.usageChecksum`と一致しなければならない。
一致しない場合はInventory取得後にFigmaファイルが変わっているため、そのリビジョンのエクスポートを破棄してInventoryからやり直す。

ScriptはUTF-8バイト数を測定し、シリアライズした返却結果が`maxPayloadBytes`を超える前にVariableの追加を止め、次の正確なindexを返す。
1件のVariableだけで収まらない場合は、それまでの証拠を保持して停止し、ツールの制限を報告する。
それでもプロバイダーがレスポンスを切り詰めた場合、またはJSONが不完全な場合は、そのレスポンスを破棄し、承認された上限を小さくして同じ`startIndex`から再試行する。
複数のMCPレスポンスを再構成した合成JSONを作らない。

### 6. 使用中のLibrary Variableをエクスポートする

ハードゲートで依頼者が`complete`を選択した後だけ、この節を実行する。
`local-only`では、この節をすべて省略する。

Inventoryの`libraryCollections`にある件数1件以上のCollectionをすべて処理する。
Scriptは、該当Collectionのチェックサム付きExport計画から、現在のBatchに含まれるIDだけを読み取る。
使用閉包を再計算しない。
ページを再走査せず、有効化済みCollectionの残りを列挙せず、Variableをインポートしない。

各呼び出しで、次の手順を実行する。

1. `node <skill-directory>/scripts/prepare-use-figma-code.mjs --phase library --raw-dir src/design-tokens/raw --collection-index <inventory-index> --start-index <index> --output "<prepared-code-directory>/library-<collection-index>-<index>.js"`を実行する。
2. 準備済みコードを一度だけ読み、`use_figma`で実行する。
3. 返却結果を補助Scriptが報告した正確な絶対`artifactPath`へ直ちにそのまま保存する。
4. `hasMore`が`false`になるまで、`pagination.nextStartIndex`から続行する。

補助ScriptはInventory上のCollection indexを保存先へ使うため、機密性のある名前やKeyがファイル名に入らない。
返却されたパスを変更せず、一方のCollectionで他方を上書きしない。

各Batchで、取得元ファイル名、任意のLibrary名、Collection Key、fileKey、payloadチェックサム、Export計画チェックサム、使用集合チェックサム、Batch identityチェックサム、ページ分割の計算、設定した抽出上限、一意な成功Keyと失敗Keyを確認する。
取得元の使用集合チェックサムは、該当する`inventory.libraryCollections[].usageChecksum`と一致しなければならない。
ローカルExportと同じサイズ上限制御を使う。
解消しない抽出エラーを保持し、検証条件を緩めない。

## 参照の完全性を証明する

CSSを生成する前に、次を検証する。

- ページ一覧、すべてのページ走査、Inventory、対象範囲に含めるすべてのBatchでpayloadチェックサムが正しく、fileKeyが一つに揃っている。
- ページ走査のページIDが、順序付きページ一覧を欠落、重複、置換、エラーなしで完全に網羅する。
- rawページ走査のdirect ID和集合と集計件数が、Inventoryの使用Manifestと完全に一致する。
- ローカルとLibraryの使用集合チェックサムがInventoryと一致する。
- 完全使用とローカルFallbackでは、範囲選択後にサイズ制限付きExport計画がInventoryを再証明する。local-only高速経路では、代わりにInventory埋込み計画の件数とチェックサムを厳密に検証する。
- すべてのエクスポートのdirect ID、Export計画、Batch identityの各チェックサムが、検証済み計画、Inventory、自身のpayloadに一致する。
- 各Batch列が`0`から始まり、欠番と重複のない連続範囲を覆い、総件数が一定で、最後の`hasMore`が`false`である。
- 一意な成功Keyと一意な失敗Keyの合計が、Inventoryの各件数と一致する。
- エクスポート済みVariable IDが、選択したInventory Export計画と完全に一致する。
- 完全使用では、エクスポートした値からAlias閉包を再計算し、Inventoryとの完全一致を必須とする。
- ローカル使用限定では、エクスポートしたVariableが参照するすべてのAlias IDを、別のエクスポート済みローカルVariableとして解決できる。

抽出エラー、未解決の使用Variable ID、使用集合チェックサムの変化、未解決Alias、payloadチェックサム不一致があれば、件数が一致しても生成は未完了とする。
取得に成功した成果物を保持し、その保存場所を報告する。
本番用CSSは生成しない。

完全使用では、次を実行する。

```bash
node <skill-directory>/scripts/generate-design-tokens.mjs --validate-only
```

ローカル使用限定では、次を実行する。

```bash
node <skill-directory>/scripts/generate-design-tokens.mjs --validate-only --local-only
```

検証の成功を必須とする。
ローカル使用限定の検証はLibrary成果物を除外するが、対象ローカルVariableが除外したAlias依存先を参照する場合は失敗する。

## CSSを生成して失敗原因を調べる

完全使用の検証後は、次を実行する。

```bash
node <skill-directory>/scripts/generate-design-tokens.mjs
```

ローカル使用限定の検証後は、次を実行する。

```bash
node <skill-directory>/scripts/generate-design-tokens.mjs --local-only
```

対象プロジェクトの作業ディレクトリから実行し、成功を必須とする。
承認済みのプロジェクト固有設定を使う場合は、検証コマンドと生成コマンドへ`--config <config-path>`を追加する。
CSSが残り、認識済みの一時JSONが削除され、空になったrawディレクトリが削除されたことを確認する。

失敗した場合は、エラーの種類に応じて次のように処理する。

- **Usage checksum drift**：一つの安定したFigmaリビジョンを対象に、Inventoryからやり直す。
- **Invalid WEB codeSyntax**：`INVALID_WEB_CODE_SYNTAX`の警告と命名元件数を確認する。不正な構文が採用されたと仮定しない。
- **Unknown FLOAT unit**：意図した単位を確定してから、名前またはScopeのルールを追加する。`px`を推測しない。
- **CSS name collision**：衝突したすべてのVariableと命名元をローカルで確認し、警告コードと件数だけを報告する。依頼者の承認を得た場合だけ命名規則を変更する。
- **Single Variable exceeds the payload limit**：該当するIDはローカル診断に保持し、外部にはエラー種別と設定上限だけを報告する。項目を省略せず、一つのVariableを複数レスポンスへ分割せず、JSONを手作業で組み立てない。
- **Unresolved alias**：不足しているIDをローカルで特定する。ローカル使用限定がリモート依存先を除外した場合は完全使用を選び、外部にはエラー種別と件数だけを報告する。Aliasを推測したリテラルへ置き換えず、検証条件を緩めない。
- **Conflicting declaration**：Selector、CSS名、Mode、取得元Variableをローカルで確認し、外部には衝突種別と件数だけを報告する。最後に書いた値を採用せず、FigmaのMode設計または命名設計を修正する。
- **Unknown mode selector**：Modeを明示的に割り当てるか、`skip`または`error`の承認を得る。Selectorをまたぐ同値宣言を自動削除しない。
- **Completeness failure**：使用集合チェックサムが変わっていない場合は、問題のあるInventoryまたはBatchだけを再取得する。

Figmaの命名、Mode、意味に関わる設定をプロダクト上の判断として扱う。
依頼に意図した対応関係が明記されていなければ、証拠を提示して方針の指定を求める。

## 結果を報告する

次を報告する。

- 機密性のある実行元情報を繰り返さず、指定された対象を使用したことの確認
- ハードゲートで選択した範囲
- ページ一覧件数、検証済みページ走査件数、ページ走査の再試行、同時編集リスク
- 直接Binding数、Alias依存数、使用中ローカルVariable数、使用中Library Variable数、ローカル定義総数、有効化済みLibrary数、有効化済みだが未使用のLibrary数
- CSS Variable数と宣言数、Selector、型別件数、Alias数、CSS名の命名元別件数、警告コードと件数、未解決Alias件数、単位エラー件数、名前衝突件数
- 生成したCSSのパス、失敗時に保持した成果物、成功時のJSON削除結果と空ディレクトリ削除結果
- 検証とジェネレーターの実行結果
- Export計画の取得元（`inventory`高速経路または`mcp`）、前提確認、ページ走査、Inventory、範囲選択待ち、Export計画、Variable Export、生成の各所要時間、`use_figma`呼び出し数、回避可能だった再試行
- Figmaを変更していないことの確認、再試行、設定変更、未解決のblocker

この報告へFigma URL、fileKey、ファイル名、ページ名、組織名、Library名、Collection名、ID、Key、rawの警告Message、ローカル失敗診断の原文を含めない。

選択した使用範囲について、整合性検証、使用集合検証、参照解決、生成前検証、CSS書込後の一致確認、一時JSON削除、空ディレクトリ削除に成功した場合だけ、**完了**と報告する。
