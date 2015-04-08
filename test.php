<?php
	$glob = array(
		1, 2.45, "4", true, null,
		array(),
		array("a" => 1, "b" => 2, "c" => array(1, 2, 3))
	);

	$cicular = array("cicular" => "cicular");
	$cicular[0] =& $cicular;

	class Test {
		private $bar = 42;

		function foo($foo) {
			$this->bar += $foo;
		}
	}

	function y($y) {
		echo $y;
	}

	function x($x) {
		echo $x;
		y($x);
	}

	//phpinfo();
	x("Hello world!");

	$test = new Test();
	$test->foo(1);
?>