import ts from "typescript";

export type TypeNode = (
  | ts.InterfaceDeclaration
  | ts.TypeAliasDeclaration
  | ts.EnumDeclaration
) & {
  visited?: boolean;

  /**
   * this flag indicates if the type is exported from the file
   */
  exported?: boolean;
};

export function isTypeNode(node: ts.Node): node is TypeNode {
  return (
    ts.isInterfaceDeclaration(node) ||
    ts.isTypeAliasDeclaration(node) ||
    ts.isEnumDeclaration(node)
  );
}

export function getExtractedTypeNames(
  node: TypeNode,
  sourceFile: ts.SourceFile,
): string[] {
  const referenceTypeNames = new Set<string>();
  referenceTypeNames.add(node.name.text);

  const recursiveExtract = (node: TypeNode) => {
    if (node.visited) {
      return;
    }

    const heritageClauses = (node as ts.InterfaceDeclaration).heritageClauses;

    if (heritageClauses) {
      heritageClauses.forEach((clause) => {
        const extensionTypes = clause.types;
        extensionTypes.forEach((extensionTypeNode) => {
          const typeName = extensionTypeNode.expression.getText(sourceFile);

          referenceTypeNames.add(typeName);
        });
      });
    }
  };

  const visitorExtract = (child: ts.Node) => {
    const childNode = child as ts.PropertySignature;
    if (!ts.isPropertySignature(childNode)) {
      return;
    }

    if (childNode.type) {
      if (ts.isTypeReferenceNode(childNode.type)) {
        referenceTypeNames.add(childNode.type.getText(sourceFile));
      } else if (
        ts.isArrayTypeNode(childNode.type) &&
        ts.isTypeNode(childNode.type.elementType)
      ) {
        referenceTypeNames.add(childNode.type.elementType.getText(sourceFile));
      } else if (ts.isTypeLiteralNode(childNode.type)) {
        childNode.type.forEachChild(visitorExtract);
      } else if (
        ts.isIntersectionTypeNode(childNode.type) ||
        ts.isUnionTypeNode(childNode.type)
      ) {
        childNode.type.types.forEach((typeNode: ts.TypeNode) => {
          if (ts.isTypeReferenceNode(typeNode)) {
            referenceTypeNames.add(typeNode.getText(sourceFile));
          } else typeNode.forEachChild(visitorExtract);
        });
      }
    };
  };

  recursiveExtract(node);
  return [node.name.text, ...referenceTypeNames];
}

export function getExtractedTypeNamesFromExportDeclaration(
  node: ts.ExportDeclaration & { moduleSpecifier: ts.StringLiteral }
) {
  const referenceTypeNames: string[] = [];

  const eventuallyAddType = (childNode: ts.Node) => {
    if (ts.isNamedExports(childNode)) {
      childNode.elements.forEach((element) => {
        if (ts.isIdentifier(element.name)) {
          referenceTypeNames.push(element.name.escapedText.toString());
        }
      });
    }
  };

  node.forEachChild(eventuallyAddType);

  return referenceTypeNames;
}
