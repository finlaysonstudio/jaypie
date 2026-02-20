import { NavMenu } from "../NavMenu";
import styles from "../dimensions/dimensions.module.css";

export default function ComponentsPage() {
  return (
    <div className={styles.page}>
      <NavMenu />
      <h1 className={styles.title}>Components</h1>
    </div>
  );
}
