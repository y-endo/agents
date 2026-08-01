# Figma Variable Extract 日本語参考訳

> このファイルは、人間がスキルの内容を確認するための参考訳です。
> Codexがスキルを実行するときの正本は `SKILL.md` です。
> 内容に差異がある場合は `SKILL.md` を優先してください。
> 翻訳元SHA-256：`7b4ceb0ff9b94ea2c1e3d9177b9792f5c28ebcc2f07cc99f042ae766d0e8fc7a`

MCPの返却結果をそのまま抽出し、エクスポートが完全であることを証明してからCSSを生成する。
raw JSONは一時的な証拠として扱い、検証を通すために編集しない。
検証済みCSSの生成に成功した後だけ削除する。

## 生成範囲を明示的に選択してもらう

Figma DesignファイルのURLを必須とする。
URLが指定されていなければ質問する。
URLからfileKeyを解析し、実行元の証跡として保持する。
この再利用スキルの公開リポジトリへ実在fileKeyを記録しない。

CSSの公開範囲は、次の2種類だけとする。

- **ローカル限定生成**：Inventoryを取得し、ローカルVariableだけをエクスポートして、`--local-only`でCSSを生成する。Library Variableはエクスポートもインポートもしない。Libraryを明示的に対象外とする依頼でのみ使用する。
- **完全生成**：ローカルVariableと、有効化済みのすべてのLibrary CollectionをエクスポートしてからCSSを生成する。Libraryエクスポートによって対象FigmaファイルへVariableをインポートする可能性がある。

CSSを検証または生成するすべての処理に、次の**ハードゲート**を適用する。

1. 前提条件を確認してから、読み取り専用のInventory取得だけを実行する。
2. 対象ファイル名とURL、ローカルCollection数とVariable数、有効なLibrary Collection数とVariable数、Inventoryエラーを報告する。
3. `local-only`または`complete`を選ぶよう依頼者へ質問する。`local-only`はすべてのLibrary Variableを除外し、LibraryインポートによるFigma変更を行わないと説明する。`complete`はすべての有効なLibrary Collectionを含め、Variable数が1件以上のLibrary Variableを対象ファイルへインポートすると説明する。
4. 直接的で曖昧さのない選択を待つ。待機中は、どちらのエクスポートScriptも実行せず、検証、CSS生成、保持済み成果物の削除または置換、生成範囲の推測を行わない。

既定値を設けない。
最初の依頼文が生成範囲を指定しているように見える場合でも、Inventoryの要約を提示した後に選択を得る。
沈黙、以前の実行、既存JSON、設定、編集権限、空のLibrary一覧を、生成範囲の選択とみなさない。
回答が曖昧なら再度質問する。
Library一覧が空の場合は現在のCSS結果が同等になる見込みを説明するが、それでも生成範囲の選択を必須とする。

`complete`の選択は、選択肢の提示時に対象ファイル、Library件数、ファイル変更を明示していた場合だけ、全Libraryインポートの承認を兼ねる。
明示していなければ、最初のLibraryエクスポート前に別途確認する。
`local-only`ではLibraryエクスポートScriptを実行しない。

次のモードは、それだけではCSSの生成範囲を選択したことにならない。

- **抽出のみ**：明示された範囲のInventory取得またはエクスポートだけを実行する。CSSが最新であるとは報告しない。
- **再開**：失敗した実行後に残った一時InventoryとBatchを調べ、不足または不正なBatchだけを再取得する。ファイル名だけを根拠に正常と判断しない。

抽出のみまたは再開からCSSの検証や生成へ進む場合は、先にハードゲートを通過する。
一部のLibraryだけを対象にしたCSS生成を、完全な生成として提案しない。
`--local-only`では、一時入力ディレクトリに認識可能なLibrary JSONが残っていても、すべて検証とCSS生成から除外する。

## 前提条件を確認する

1. この`SKILL.md`を基準にスキルディレクトリを解決し、書き込み可能な対象プロジェクトの作業ディレクトリを必須とする。出力先ツリーを事前に作る必要はない。
2. `PATH`上で`node`を利用できるか確認する。利用できなければ停止し、Node.js 22以上が必要であると報告する。依頼者の承認なしにNode.jsをインストールしたり、リモートのインストールScriptを実行したりしない。
3. `node <skill-directory>/scripts/generate-design-tokens.mjs --check-runtime`を実行する。成功した場合だけ続行する。
4. Node.jsが22未満の場合は、是正前に対象プロジェクトの既存ランタイム宣言と、インストール済みのバージョンマネージャーを確認する。プロジェクトが管理している互換ランタイムを優先する。依頼者の承認なしに`.nvmrc`、`.node-version`、`.tool-versions`、`mise.toml`、`package.json`、グローバルのNode.js、または同等の方針を上書きしない。ランタイムのインストールが必要な場合は、現在サポートされているLTSを推奨し、使用するバージョンマネージャーの最新の公式コマンドを確認してから実行する。
5. 同梱された`scripts/01-inventory.js`、`scripts/02-export-local.js`、`scripts/03-export-library-collection.js`、`scripts/generate-design-tokens.mjs`、`assets/design-tokens.config.json`を読む。これらを正本とし、スキル単体で利用する。
6. 通常は同梱設定を使う。プロジェクト固有の意味的なルールが必要な場合は、再利用するスキルの外へ設定をコピーし、依頼者の承認を得てコピーを編集し、`--config`で指定する。同梱設定を暗黙に変更しない。
7. ツールの返却形式に合わせるためだけに、同梱された抽出Scriptを変更しない。
8. 接続済みの**Figma公式Remote MCP**を特定し、現在のツールスキーマを確認する。Figmaツールが公開されていなければツール探索を使用する。Claude固有のMCPサーバープレフィックスをハードコードしない。
9. `use_figma`を呼び出す前に、毎回、そのプロバイダーの仕組みを使って最新の公式`figma-use`スキルを最後まで読む。確認した`use_figma`スキーマがスキル識別子を要求する場合は、その識別子を渡す。
10. `use_figma`または`figma-use`を利用できなければ停止し、接続が不足していることを報告する。`get_variable_defs`、ブラウザスクレイピング、推測したREST API、捏造データへフォールバックしない。
11. この処理では`get_variable_defs`を使用しない。このツールでは、必要なファイル全体のVariable定義を列挙できない。
12. 同梱Scriptのコードは、トップレベルの`await`と`return`を使って送信する。async IIFEで囲まず、`figma.closePlugin()`を呼び出さない。

Libraryのエクスポートは`importVariableByKeyAsync`を呼び出すため、対象Figmaファイルを変更する可能性がある。
Inventory取得は読み取り専用なので先に実行する。
完全生成を選択肢として提示する前に、複製ファイルまたは検証用ファイルの使用を優先する。
上記のハードゲートでの選択、または別の明示的な確認によって、フルスコープとファイル変更の両方を承認してもらう。
沈黙、編集権限、または「ファイルを変更しないなら可」のような条件付き同意を承認とみなさない。
ローカル限定生成ではLibraryエクスポートScriptを実行せず、Libraryインポートの承認も求めない。

## 一時成果物を管理する

設定された`inputDirectory`へ、一時的な`raw/`ツリーを直接作る。
既定の保存先は`src/design-tokens/raw`とする。
OSの一時ディレクトリや別のステージング場所は使わない。

```text
raw/
├── inventory.json
├── local/batch-<start-index>.json
└── libraries/<library-slug>/<collection-slug>/batch-<start-index>.json  # 完全生成のみ
```

このディレクトリ内のすべてのJSONを、1回の抽出に属する一時成果物として扱う。
新規実行前に既存JSONを確認する。
同じ対象ファイルと依頼範囲に属する場合だけ再開に使用する。
別の実行結果である場合は新しい結果と混在させず、失敗時の証拠を削除または置換する前に依頼者の承認を得る。

ジェネレーターは、最終CSSを書き込み、再読込による一致確認に成功した後だけ、認識した入力JSONと一時report JSONを削除する。
その後、`local/`、Library配下の各ディレクトリ、`libraries/`、`raw/`を含め、設定された入力ディレクトリまで空のディレクトリを末端から削除する。
非JSONファイルなどの保持対象が残るディレクトリは削除しない。
`--validate-only`、`--dry-run`、失敗した生成ではJSONとディレクトリを残し、原因調査と再開に利用できる状態を保つ。
抽出のみではCSS生成が完了しないため、依頼された一時成果物を残す。
ローカル限定生成では、入力ディレクトリに残った認識可能なLibraryエクスポートをチェックサム検証とCSS生成から除外し、除外件数を報告する。
CSSの書き込みと再読込に成功した後は、ほかの一時JSONと一緒に削除する。

`use_figma`が返したオブジェクトは、要約、省略、値の変更、レコードの結合、エラーの手編集をせずに保存する。
検証するときだけ、返却オブジェクトのコピーをパースする。
途中で切れたレスポンス、JSONではないレスポンス、ツールエラーのレスポンスは公開しない。

## Variableを抽出する

### 1. Inventory

同梱された`scripts/01-inventory.js`を読む。
`const sourceFileKey = "__FILE_KEY__";`の宣言だけを、対象URLから解析したfileKeyをJSONエンコードして含む宣言へ置き換える。
置換後のコードを対象URLで実行し、返却されたオブジェクトをそのまま`src/design-tokens/raw/inventory.json`へ保存する。

次を確認する。

- `kind`が`figma-variable-inventory`であり、`schemaVersion`が`1`である。
- `fileKey`が対象URLと一致する。
- `integrity.algorithm`が`fnv1a32-utf16`である。公開前にジェネレーターでチェックサムを検証する。このチェックサムは偶発的な転記変更を検出するものであり、悪意ある改竄への耐性は保証しない。
- ローカルCollection数とVariable数が0以上の整数である。
- 各Library CollectionのKeyが一意である。
- すべてのLibrary Collectionで、`variableCount`が整数、`error`が`null`である。

失敗したInventory呼び出しだけを再試行する。
再試行後もCollectionにエラーまたはnullの件数が残る場合は、結果を保持し、完全生成を選択できない状態として扱う。
ローカル限定生成は、ローカル側のInventoryが正常なら選択できる。
Library件数は公開範囲外なので、Inventory上のLibraryエラーをハードゲートの要約へ含め、依頼者の選択を待つ。

Library Collection一覧が空の場合は、Figma UI上で有効化されたLibraryだけが検出対象になることと、どちらの生成範囲でも現在のCSS結果は同等になる見込みを報告する。
その場合も、ローカルのエクスポート前にハードゲートでの選択を必須とする。
不足しているLibraryを推測しない。

### 2. ローカルVariable

ハードゲートで依頼者が`local-only`または`complete`を選択した後だけ、この節を実行する。
どちらの公開範囲でもローカルエクスポートは必要になる。

依頼で指定されたBatch Sizeを使い、指定がなければ`20`を使う。
Batch Sizeは1から200までの整数に限定する。
これは保守的な開始値であり、固定のレスポンスサイズ上限を仮定するものではない。
InventoryのローカルVariable数が0件でも、少なくとも1回は実行する。

各呼び出しで、次の手順を実行する。

1. 同梱された`scripts/02-export-local.js`を新しく読み直す。
2. `const sourceFileKey = "__FILE_KEY__";`の宣言だけを、対象fileKeyをJSONエンコードして含む宣言へ置き換える。
3. `const startIndex = __START_INDEX__;`と`const batchSize = __BATCH_SIZE__;`の宣言全体を、検証済みの10進整数を使った宣言へ置き換える。
4. 置換後のコードを`use_figma`で実行する。
5. 返却結果をそのまま`src/design-tokens/raw/local/batch-${String(startIndex).padStart(4, "0")}.json`へ保存する。
6. `hasMore`が`false`になるまで、`pagination.nextStartIndex`から続行する。

各Batchについて、次を確認する。

- スキーマと取得元ファイル名がInventoryと一致する。
- 取得元fileKeyがInventoryおよび対象URLと一致する。
- payloadに抽出時のintegrityチェックサムが含まれる。
- Collection数とCollection KeyがInventoryと一致する。
- `startIndex`、`batchSize`、`total`に矛盾がない。
- `returnedDescriptorCount === successCount + errorCount`である。
- `nextStartIndex === startIndex + returnedDescriptorCount`である。
- 成功した各Variableが、格納先のCollectionに属している。
- 成功したKeyとエラーになったKeyが一意であり、このBatchに属している。

プロバイダーがレスポンスの切り詰めを明示した場合、またはJSONが不完全な場合は、そのレスポンスを破棄する。
そのうえでBatch Sizeを半分にし、同じ`startIndex`から再試行する。
1件のBatchでも切り詰められる場合は停止し、クライアントまたはツールの制限を報告する。
複数のMCPレスポンスを再構成して、合成した`local-variables.json`を作らない。

### 3. Library Variable

ハードゲートで依頼者が`complete`を選び、その選択が説明済みのファイル変更を承認している場合だけ、この節を実行する。
`local-only`では、この節をすべて省略する。
ローカル限定生成では、`scripts/03-export-library-collection.js`も`importVariableByKeyAsync`も呼び出さない。

完全生成では、Inventoryに記録されたVariable数が1件以上のLibrary Collectionをすべて処理する。
Variable数が0件のCollectionは空のBatchを捏造せず、完了として記録する。
現行バリデーターは、Variable数が0件のCollectionをページ分割Batchの必須検証から除外する。

依頼で指定されたBatch Sizeを使い、指定がなければ`20`を使う。
Batch Sizeは1から200までの整数に限定する。
これは保守的な開始値であり、固定のレスポンスサイズ上限を仮定するものではない。
各呼び出しで、次の手順を実行する。

1. 同梱された`scripts/03-export-library-collection.js`を新しく読み直す。
2. `const sourceFileKey = "__FILE_KEY__";`の宣言だけを、対象fileKeyをJSONエンコードして含む宣言へ置き換える。
3. `const collectionKey = "__COLLECTION_KEY__";`の宣言全体を、JSONエンコードしたCollection Keyを含む宣言へ置き換える。
4. `const startIndex = __START_INDEX__;`と`const batchSize = __BATCH_SIZE__;`の宣言全体を、検証済みの10進整数を使った宣言へ置き換える。
5. 置換後のコードを`use_figma`で実行する。
6. 返却結果をそのまま`src/design-tokens/raw/libraries/<library-slug>/<collection-slug>/batch-${String(startIndex).padStart(4, "0")}.json`へ保存する。
7. `hasMore`が`false`になるまで、想定したオフセットではなく返却された`pagination.nextStartIndex`から続行する。

Library名とCollection名のSlugは、ASCIIの英小文字、数字、ハイフンだけに正規化する。
正規化後に空になった場合は、Collection Keyの先頭12文字を使う。
書き込み前にすべての保存先を計算する。
保存先が衝突した場合は、Collection Keyの先頭12文字を末尾へ付ける。
一方のCollectionで他方を上書きしない。

各Batchについて、次を確認してから処理を続ける。

- 取得元ファイル名、Library名、Collection KeyがInventoryと一致する。
- 取得元fileKeyがInventoryおよび対象URLと一致する。
- payloadに抽出時のintegrityチェックサムが含まれる。
- `startIndex`、`batchSize`、`total`と、すべてのページ分割件数に矛盾がない。
- `returnedDescriptorCount === successCount + errorCount`である。
- `nextStartIndex === startIndex + returnedDescriptorCount`である。
- 成功したKeyとエラーになったKeyが一意であり、このBatchに属している。

プロバイダーがLibraryレスポンスの切り詰めを明示した場合、またはJSONが不完全な場合は、そのレスポンスを破棄する。
そのうえでBatch Sizeを半分にし、同じ`startIndex`から再試行する。
1件のBatchでも切り詰められる場合は停止し、クライアントまたはツールの制限を報告する。
固定のレスポンスサイズ上限を仮定しない。
完全なBatchにインポートエラーが含まれる場合は、そのBatchを保持する。
再試行に意味がある場合は、そのBatchだけを再試行して、解消しないエラーを報告する。
検証条件を緩めない。

## 完全性を証明する

一時rawデータからCSSを生成する前に、どの生成範囲でも次を検証する。

- ローカルVariable数がInventoryと一致する。
- ローカルBatchが`0`から始まり、範囲が連続しており、`pagination.total`が一定で、最終Batchの`hasMore`が`false`である。
- 対象範囲に含めるすべての返却結果のfileKeyがInventoryおよび対象URLと一致する。
- 対象範囲に含めるすべてのpayloadのintegrityチェックサムが検証に成功する。

完全生成では、さらに次を検証する。

- Variable数が1件以上のすべてのLibrary Collectionで、Batch列が`0`から始まる。
- Batchの範囲が連続しており、欠番と重複がない。
- `pagination.total`が全Batchで一定であり、Inventoryの`variableCount`と一致する。
- 最終Batchの`hasMore`が`false`である。
- 一意な成功Keyと一意なエラーKeyの合計が、期待件数と一致する。
- 同じVariable Keyが複数のBatchに現れない。

件数の計算が一致しても、選択した範囲に解消していない抽出エラーまたはチェックサム不一致があれば生成は未完了とする。
取得に成功した一時成果物と`src/design-tokens/raw`の保存場所を報告する。
本番用CSSは生成しない。

ハードゲートを通過する前にCSSを検証または生成しない。
完全生成では、生成前に次を実行する。

```bash
node <skill-directory>/scripts/generate-design-tokens.mjs --validate-only
```

成功を必須とする。
この処理は生成ファイルを書き込まず、JSONパース、payloadチェックサム、fileKey、Batchの連続性、Inventory件数、Alias、単位、Selector、CSS名衝突を検証する。

ローカル限定生成では、次を実行する。

```bash
node <skill-directory>/scripts/generate-design-tokens.mjs --validate-only --local-only
```

このコマンドはInventoryとローカルBatchだけを検証する。
Inventoryに記録されたLibrary Collectionと`raw/`配下に残ったLibraryエクスポートJSONは除外して報告し、ローカル入力の不足とはみなさない。

検証済みJSONを別の場所へ移動しない。
通常の生成コマンドは、同じ設定済み入力ディレクトリからJSONを読む。
ジェネレーターは、クリーンアップ時に無関係なファイルを削除しないよう、入力ディレクトリ内の認識できないJSONを拒否する。

## CSSを生成して失敗原因を調べる

依頼者が完全生成を選択した後、次を実行する。

```bash
node <skill-directory>/scripts/generate-design-tokens.mjs
```

対象プロジェクトの作業ディレクトリから実行し、成功することを必須とする。
同梱の既定設定では、必要に応じて`src/design-tokens/generated/`が作成される。
ジェネレーターは`design-tokens.css`を書き込んで検証し、reportの要約を標準出力へ表示した後、`src/design-tokens/raw`配下の認識済みJSON、一時的な`design-tokens.report.json`、`raw/`配下の空ディレクトリを削除する。
完了を報告する前に、CSSが残り、一時JSONが残っていないことを確認する。
非JSONファイルなどの保持対象がなければ、`raw/`自体も残っていないことを確認する。

依頼者がローカル限定生成を選択した後、次を実行する。

```bash
node <skill-directory>/scripts/generate-design-tokens.mjs --local-only
```

`completeness.scope`が`local-only`、`libraryCollectionsChecked`が`0`であり、除外したLibrary件数がInventoryと一致することを必須とする。
生成したCSSにLibrary Variableが含まれていないことも確認する。

承認済みのプロジェクト固有設定を使う場合は、検証コマンドと生成コマンドへ`--config <config-path>`を追加する。

失敗した場合は、エラーの種類に応じて次のように処理する。

- **Invalid WEB codeSyntax**：`INVALID_WEB_CODE_SYNTAX`の警告と`counts.cssNameSources`を確認する。ジェネレーターは派生名へフォールバックするため、FigmaのWEB構文が採用されたと仮定しない。
- **Unknown FLOAT unit**：Variable名、Scope、値を特定する。意図した単位が確定している場合に限り、`float.nameRules`または`scopeRules`へ明示的なルールを追加する。`px`を推測しない。
- **CSS name collision**：衝突したすべてのVariableと命名元を報告する。最初にFigmaの`codeSyntax.WEB`を確認し、その後、依頼者の承認を得て命名規則を変更する。`naming.includeLibraryName: true`は同名Libraryの衝突を防げる場合があるが、公開CSS Token名を変更するため暗黙に有効化しない。raw Variableを削除または編集しない。
- **Unresolved alias**：証拠から判断できる場合は、不足しているVariable IDまたはKeyを特定する。参照先Libraryを有効化してエクスポートする。Aliasを推測したリテラル値へ置き換えず、`aliases.unresolved`を緩めない。
- **Conflicting declaration**：Selector、CSS名、Mode、取得元Variableを特定する。FigmaのMode設計または命名設計を修正する。最後に書いた値を採用する処理へ変更しない。
- **Unknown mode selector**：`unknownModeStrategy: "attribute"`では`[data-figma-mode="..."]`を出力する。依頼者の承認を得てModeを明示的に割り当てるか、`skip`または`error`を選ぶ。CSSのカスケードと継承によって意味が変わる可能性があるため、Selectorをまたぐ同値宣言を自動削除しない。
- **Completeness failure**：問題のあるInventory、ローカルエクスポート、Library Batchだけを再取得する。正常な抽出処理を最初からやり直さない。

Figmaの命名やMode、意味に関わる設定ルールの変更は、プロダクト上の判断として扱う。
依頼に意図した対応関係が明記されていなければ、証拠を提示して方針の指定を求める。

## 結果を報告する

次を報告する。

- 対象Figmaファイル名とURL
- ハードゲートで依頼者が明示的に選択した生成範囲
- ローカルCollection数とVariable数
- Library数、Collection数、成功件数、失敗件数
- ローカル限定生成または抽出のみの場合は、対象外とした範囲
- CSS Variableまたは宣言数、Selector、型別件数、Alias数、CSS名の命名元件数、無視した不正なWEB構文、未解決Alias、単位の警告とエラー、名前衝突
- 生成したCSSのパス、失敗時に残した一時成果物のパス、成功時のJSON削除結果と空ディレクトリ削除結果
- 検証とジェネレーターの実行結果
- Figmaへの変更、設定変更、再試行、未解決のblocker

依頼されたモードの整合性検証に成功した場合だけ、**完了**と報告する。
完全生成では、抽出エラーが0件、payloadチェックサム検証済み、`--validate-only`成功、CSS生成後の一致確認、JSON削除成功、空の一時ディレクトリ削除成功を必須とする。
ローカル限定生成では、`--local-only`を付けた同等のローカル範囲検証、reportでのLibrary除外の明示、CSSにLibrary宣言がないこと、JSON削除成功、空の一時ディレクトリ削除成功を必須とする。
