import { NavMenu } from "../NavMenu";
import styles from "../dimensions/dimensions.module.css";

export default function LayoutPage() {
  return (
    <div className={styles.page}>
      <NavMenu />
      <h1 className={styles.title}>Layout</h1>
    </div>
  );
}
