import 'package:flutter/foundation.dart';
import 'package:flutter/rendering.dart';
import 'package:poko_design_system/src/tokens.dart';

/// A rendered interactive element measured in logical pixels.
@immutable
final class PokoMeasuredHitTarget {
  const PokoMeasuredHitTarget({
    required this.id,
    required this.width,
    required this.height,
    this.isChildZone = true,
  });

  final String id;
  final double width;
  final double height;

  /// Parent-zone controls use platform minimums and are outside INV-14.
  final bool isChildZone;
}

/// One child-zone target that is smaller than [PokoTouch.min].
@immutable
final class PokoHitTargetViolation {
  const PokoHitTargetViolation({
    required this.id,
    required this.width,
    required this.height,
    required this.shortfallX,
    required this.shortfallY,
  });

  final String id;
  final double width;
  final double height;
  final double shortfallX;
  final double shortfallY;
}

/// Returns every undersized child-zone target instead of stopping at the first.
List<PokoHitTargetViolation> findPokoHitTargetViolations(
  Iterable<PokoMeasuredHitTarget> targets, {
  double minimumExtent = PokoTouch.min,
}) {
  assert(minimumExtent >= 0);

  return <PokoHitTargetViolation>[
    for (final target in targets)
      if (target.isChildZone &&
          (target.width < minimumExtent || target.height < minimumExtent))
        PokoHitTargetViolation(
          id: target.id,
          width: target.width,
          height: target.height,
          shortfallX: (minimumExtent - target.width).clamp(0, double.infinity),
          shortfallY: (minimumExtent - target.height).clamp(0, double.infinity),
        ),
  ];
}

/// Measures direct-manipulation nodes from a Flutter view's semantics tree.
///
/// A semantics rectangle is the actual accessible hit area, not merely the
/// painted child. Transforms are accumulated so scaled controls are measured in
/// root logical coordinates.
List<PokoMeasuredHitTarget> measurePokoInteractiveSemantics(
  SemanticsNode root, {
  double devicePixelRatio = 1,
  bool Function(SemanticsNode node)? isChildZone,
}) {
  assert(devicePixelRatio > 0);
  final targets = <PokoMeasuredHitTarget>[];

  void visit(
    SemanticsNode node,
    Matrix4 parentTransform, {
    required bool applyNodeTransform,
  }) {
    final transform = parentTransform.clone();
    final nodeTransform = node.transform;
    if (applyNodeTransform && nodeTransform != null) {
      transform.multiply(nodeTransform);
    }

    final data = node.getSemanticsData();
    if (_isDirectlyInteractive(data)) {
      final rect = MatrixUtils.transformRect(transform, node.rect);
      targets.add(
        PokoMeasuredHitTarget(
          id: _semanticsId(node, data),
          width: rect.width / devicePixelRatio,
          height: rect.height / devicePixelRatio,
          isChildZone: isChildZone?.call(node) ?? true,
        ),
      );
    }

    node.visitChildren((child) {
      visit(child, transform, applyNodeTransform: true);
      return true;
    });
  }

  // Flutter's root transform converts logical coordinates to physical pixels;
  // the measured rectangle is normalized by [devicePixelRatio] above.
  visit(root, Matrix4.identity(), applyNodeTransform: true);
  return targets;
}

/// Asserts INV-14 against every interactive node in [root].
///
/// Throws one [FlutterError] containing all failures, so a test run does not
/// reveal undersized controls one at a time.
void assertPokoChildHitTargets(
  SemanticsNode root, {
  double minimumExtent = PokoTouch.min,
  double devicePixelRatio = 1,
  bool Function(SemanticsNode node)? isChildZone,
}) {
  final violations = findPokoHitTargetViolations(
    measurePokoInteractiveSemantics(
      root,
      devicePixelRatio: devicePixelRatio,
      isChildZone: isChildZone,
    ),
    minimumExtent: minimumExtent,
  );
  if (violations.isEmpty) {
    return;
  }

  throw FlutterError(
    describePokoHitTargetViolations(violations, minimumExtent),
  );
}

String describePokoHitTargetViolations(
  Iterable<PokoHitTargetViolation> violations, [
  double minimumExtent = PokoTouch.min,
]) {
  final failures = violations.toList(growable: false);
  if (failures.isEmpty) {
    return '';
  }
  final lines = failures.map(
    (failure) =>
        '  ${failure.id}: ${_number(failure.width)}x${_number(failure.height)} '
        '(short by ${_number(failure.shortfallX)}x${_number(failure.shortfallY)})',
  );
  return '${failures.length} interactive child-zone element(s) below the '
      '${_number(minimumExtent)}x${_number(minimumExtent)} logical-pixel minimum '
      '[INV-14]:\n${lines.join('\n')}';
}

const _directActions = <SemanticsAction>{
  SemanticsAction.tap,
  SemanticsAction.longPress,
  SemanticsAction.increase,
  SemanticsAction.decrease,
  SemanticsAction.setText,
  SemanticsAction.customAction,
  SemanticsAction.dismiss,
  SemanticsAction.focus,
  SemanticsAction.expand,
  SemanticsAction.collapse,
};

bool _isDirectlyInteractive(SemanticsData data) =>
    _directActions.any(data.hasAction);

String _semanticsId(SemanticsNode node, SemanticsData data) {
  if (data.identifier.isNotEmpty) {
    return data.identifier;
  }
  if (data.label.isNotEmpty) {
    return data.label;
  }
  return 'semantics-node-${node.id}';
}

String _number(double value) {
  if (value == value.roundToDouble()) {
    return value.toStringAsFixed(0);
  }
  return value.toStringAsFixed(1);
}
